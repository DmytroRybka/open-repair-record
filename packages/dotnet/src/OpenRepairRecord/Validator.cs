using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace OpenRepairRecord
{
    /// <summary>The outcome of checking a file against the JSON Schema.</summary>
    public sealed class Validation
    {
        public Validation(bool ok, IReadOnlyList<string> errors) { Ok = ok; Errors = errors; }
        public bool Ok { get; }
        /// <summary>Each problem in a line, e.g. 'resident.status: must be one of resolved, ...'.</summary>
        public IReadOnlyList<string> Errors { get; }
    }

    /// <summary>
    /// Validation against the Open Repair Record 1.0 JSON Schema (embedded in the assembly), with the same
    /// plain-words messages as the editor. It interprets exactly the keywords the schema uses: type, properties,
    /// required, additionalProperties, items, enum, const, pattern, $ref, if/then and boolean schemas.
    /// </summary>
    internal static class Validator
    {
        public static readonly JsonObject Schema = LoadSchema();

        private static JsonObject LoadSchema()
        {
            using var stream = typeof(Validator).GetTypeInfo().Assembly.GetManifestResourceStream("orr-1.0.schema.json")
                ?? throw new InvalidOperationException("The embedded JSON Schema is missing.");
            using var reader = new StreamReader(stream);
            return (JsonObject)JsonNode.Parse(reader.ReadToEnd())!;
        }

        private readonly struct Error
        {
            public Error(IReadOnlyList<object> path, string keyword, string param) { Path = path; Keyword = keyword; Param = param; }
            public IReadOnlyList<object> Path { get; }
            public string Keyword { get; }
            public string Param { get; }
        }

        public static Validation Validate(JsonNode? data)
        {
            var found = new List<Error>();
            Walk(data, Schema, new List<object>(), found);
            var messages = new List<string>();
            foreach (var e in found)
            {
                var text = Message(e);
                if (!messages.Contains(text)) messages.Add(text);
            }
            return new Validation(found.Count == 0, messages);
        }

        private static JsonNode? Resolve(JsonNode? schema)
        {
            if (schema is JsonObject o && o.TryGetPropertyValue("$ref", out var refNode))
            {
                var r = Js.Str(refNode) ?? "";
                const string prefix = "#/$defs/";
                if (!r.StartsWith(prefix, StringComparison.Ordinal)) throw new NotSupportedException($"Unsupported $ref {r}");
                var target = (JsonObject)Schema["$defs"]![r.Substring(prefix.Length)]!;
                var merged = new JsonObject();
                foreach (var p in target) merged[p.Key] = p.Value?.DeepClone();
                foreach (var p in o) if (p.Key != "$ref") merged[p.Key] = p.Value?.DeepClone();
                return merged;
            }
            return schema;
        }

        private static bool IsType(JsonNode? value, string type)
        {
            switch (type)
            {
                case "object": return value is JsonObject;
                case "array": return value is JsonArray;
                case "string": return value is JsonValue s && s.GetValueKind() == JsonValueKind.String;
                case "boolean": return value is JsonValue b && (b.GetValueKind() == JsonValueKind.True || b.GetValueKind() == JsonValueKind.False);
                default: throw new NotSupportedException($"Unsupported type {type}");
            }
        }

        private static bool JsonEqual(JsonNode? a, JsonNode? b) => JsonNode.DeepEquals(a, b);

        private static List<object> With(List<object> path, object segment) => new List<object>(path) { segment };

        private static void Walk(JsonNode? value, JsonNode? schemaNode, List<object> path, List<Error> found)
        {
            var schema = Resolve(schemaNode);
            if (schema is JsonValue boolSchema && boolSchema.GetValueKind() == JsonValueKind.False)
            {
                found.Add(new Error(path, "false schema", ""));
                return;
            }
            if (!(schema is JsonObject s)) return;

            var type = Js.Str(s, "type");
            if (type != null && !IsType(value, type)) found.Add(new Error(path, "type", type));
            if (s.TryGetPropertyValue("const", out var constant) && !JsonEqual(value, constant)) found.Add(new Error(path, "const", ""));
            if (s["enum"] is JsonArray allowed && !allowed.Any(e => JsonEqual(value, e)))
            {
                found.Add(new Error(path, "enum", string.Join(", ", allowed.Select(e => Js.Str(e) ?? e?.ToJsonString() ?? "null"))));
            }

            if (value is JsonObject obj)
            {
                if (s["required"] is JsonArray required)
                {
                    foreach (var name in required.Select(n => Js.Str(n)!))
                    {
                        if (!obj.ContainsKey(name)) found.Add(new Error(path, "required", name));
                    }
                }
                var props = s["properties"] as JsonObject ?? new JsonObject();
                foreach (var p in props)
                {
                    if (obj.TryGetPropertyValue(p.Key, out var child)) Walk(child, p.Value, With(path, p.Key), found);
                }
                if (s["additionalProperties"] is JsonValue ap && ap.GetValueKind() == JsonValueKind.False)
                {
                    foreach (var p in obj)
                    {
                        if (!props.ContainsKey(p.Key)) found.Add(new Error(path, "additionalProperties", p.Key));
                    }
                }
                if (s.TryGetPropertyValue("if", out var ifSchema))
                {
                    var probe = new List<Error>();
                    Walk(value, ifSchema, path, probe);
                    if (probe.Count == 0 && s.TryGetPropertyValue("then", out var thenSchema)) Walk(value, thenSchema, path, found);
                }
            }
            if (value is JsonArray arr && s.TryGetPropertyValue("items", out var items))
            {
                for (var i = 0; i < arr.Count; i++) Walk(arr[i], items, With(path, i), found);
            }
            if (value is JsonValue str && str.GetValueKind() == JsonValueKind.String && Js.Str(s, "pattern") is string pattern)
            {
                // ECMAScript: \d means 0-9 only, as in JavaScript.
                if (!Regex.IsMatch(str.GetValue<string>(), pattern, RegexOptions.ECMAScript)) found.Add(new Error(path, "pattern", ""));
            }
        }

        private static string Message(Error e)
        {
            var where = e.Path.Count == 0 ? "the file" : string.Join(".", e.Path.Select(p => Convert.ToString(p, System.Globalization.CultureInfo.InvariantCulture)));
            switch (e.Keyword)
            {
                case "additionalProperties": return $"{where}: unknown field \"{e.Param}\"";
                case "enum": return $"{where}: must be one of {e.Param}";
                case "pattern": return $"{where}: not a date like 2026-10-12 or 2026-10-12T14:20";
                case "required": return $"{where}: the required part \"{e.Param}\" is missing";
                case "false schema": return where == "closure" ? "an open record cannot have a closure" : $"{where}: boolean schema is false";
                case "type": return $"{where}: must be {e.Param}";
                case "const": return $"{where}: must be equal to constant";
                default: return $"{where}: is not valid";
            }
        }
    }
}
