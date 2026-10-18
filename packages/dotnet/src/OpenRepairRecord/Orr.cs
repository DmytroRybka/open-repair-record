using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace OpenRepairRecord
{
    /// <summary>The result of reading a file: the record, or why it is not one.</summary>
    public sealed class ParseResult
    {
        public ParseResult(JsonObject? record, IReadOnlyList<string> errors) { Record = record; Errors = errors; }
        /// <summary>The record, or null when the text is not a valid Open Repair Record 1.0.</summary>
        public JsonObject? Record { get; }
        public IReadOnlyList<string> Errors { get; }
    }

    /// <summary>
    /// Open Repair Record 1.0: read, validate and check repair completion records. The same rules, codes and
    /// messages as the editor at openrepairrecord.com and the TypeScript and Python libraries; all of them pass the
    /// same shared test vectors. Records are System.Text.Json nodes, exactly as parsed.
    /// <code>
    /// var result = Orr.Parse(File.ReadAllText("Q-1204.orr.json"));
    /// if (result.Record != null)
    ///     foreach (var f in Orr.Check(result.Record)) Console.WriteLine($"{f.Level} {f.Section} {f.Message}");
    /// </code>
    /// </summary>
    public static class Orr
    {
        public const string Version = "1.0";
        public const string SchemaUrl = "https://openrepairrecord.com/schema/orr-1.0.schema.json";

        private static readonly string[] Lists = { "work", "checks", "evidence", "open_items", "history" };
        private static readonly string[] KeyOrder =
        {
            "orr_version", "id", "title", "timezone", "related_ids", "context", "work", "checks", "evidence", "resident",
            "open_items", "status", "closure", "history",
        };

        /// <summary>The JSON Schema this version is checked against (a copy; changing it changes nothing).</summary>
        public static JsonObject Schema => (JsonObject)Validator.Schema.DeepClone();

        /// <summary>Validates parsed JSON against the schema and explains each problem in a line.</summary>
        public static Validation Validate(JsonNode? data) => Validator.Validate(data);

        /// <summary>Reads the text of a .json file, or explains why it is not an Open Repair Record 1.0.</summary>
        public static ParseResult Parse(string text)
        {
            JsonNode? data;
            try
            {
                data = JsonNode.Parse(text, documentOptions: new JsonDocumentOptions { AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow });
            }
            catch (Exception e) when (e is JsonException || e is ArgumentException)
            {
                // ArgumentException: the same key twice in one object, which System.Text.Json refuses.
                return new ParseResult(null, new[] { "This file is not valid JSON." });
            }
            // Files saved on launch day carried the pre-release number "0.1"; the fields are identical, so they open as 1.0.
            if (data is JsonObject o && Js.Str(o, "orr_version") == "0.1") o["orr_version"] = "1.0";
            if (!(data is JsonObject obj) || Js.Str(obj, "orr_version") != "1.0")
            {
                return new ParseResult(null, new[] { "This is not an Open Repair Record 1.0 file (no \"orr_version\": \"1.0\")." });
            }
            var v = Validate(obj);
            return v.Ok ? new ParseResult(obj, Array.Empty<string>()) : new ParseResult(null, v.Errors);
        }

        /// <summary>Contradictions, missing parts and tips, most serious first.</summary>
        public static IReadOnlyList<Finding> Check(JsonNode record) => Checks.Run(record);

        /// <summary>Asks the contractor for what the record does not have yet.</summary>
        public static string ContractorRequest(JsonNode record) => Messages.ContractorRequest(record);

        /// <summary>Asks the resident whether the problem is solved. Never assumes the answer.</summary>
        public static string ResidentRequest(JsonNode record) => Messages.ResidentRequest(record);

        /// <summary>"2026-10-12T14:20" becomes "12 Oct 2026, 14:20".</summary>
        public static string FormatDate(string? value) => Labels.FormatDate(value);

        public static JsonObject EmptyRecord() => new JsonObject
        {
            ["orr_version"] = Version,
            ["context"] = new JsonObject { ["area"] = "unit" },
            ["work"] = new JsonArray(),
            ["checks"] = new JsonArray(),
            ["evidence"] = new JsonArray(),
            ["resident"] = new JsonObject { ["status"] = "not_asked" },
            ["open_items"] = new JsonArray(),
            ["status"] = "open",
            ["history"] = new JsonArray(),
        };

        /// <summary>Drops what nobody wrote and puts the keys in a stable order: export, import, export gives the same file.</summary>
        public static JsonObject Clean(JsonNode record)
        {
            var output = Prune(record.DeepClone()) as JsonObject ?? new JsonObject();
            output["orr_version"] = Version;
            if (!output.ContainsKey("context")) output["context"] = new JsonObject();
            foreach (var key in Lists) if (!output.ContainsKey(key)) output[key] = new JsonArray();
            if (!output.ContainsKey("resident")) output["resident"] = new JsonObject { ["status"] = "not_asked" };
            if (!output.ContainsKey("status")) output["status"] = "open";
            if (Js.Str(output, "status") == "open") output.Remove("closure");
            var ordered = new JsonObject();
            foreach (var key in KeyOrder.Where(output.ContainsKey)) ordered[key] = Detach(output, key);
            foreach (var key in output.Select(p => p.Key).ToList()) ordered[key] = Detach(output, key);
            return ordered;
        }

        private static JsonNode? Detach(JsonObject from, string key)
        {
            var value = from[key];
            from.Remove(key);
            return value;
        }

        /// <summary>Empty strings, false, null, empty objects and empty lists all mean "not written" and are removed.</summary>
        private static JsonNode? Prune(JsonNode? node)
        {
            switch (node)
            {
                case null:
                    return null;
                case JsonArray a:
                {
                    var items = a.Select(Prune).Where(x => x != null).ToList();
                    if (items.Count == 0) return null;
                    var result = new JsonArray();
                    foreach (var item in items) result.Add(item!.DeepClone());
                    return result;
                }
                case JsonObject o:
                {
                    var result = new JsonObject();
                    foreach (var p in o)
                    {
                        var v = Prune(p.Value);
                        if (v != null) result[p.Key] = v.DeepClone();
                    }
                    return result.Count == 0 ? null : result;
                }
                case JsonValue v:
                    switch (v.GetValueKind())
                    {
                        case JsonValueKind.String:
                        {
                            var trimmed = Js.Trim(v.GetValue<string>());
                            return trimmed.Length == 0 ? null : JsonValue.Create(trimmed);
                        }
                        case JsonValueKind.False:
                        case JsonValueKind.Null:
                            return null;
                        default:
                            return v.DeepClone();
                    }
                default:
                    return node.DeepClone();
            }
        }
    }
}
