using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace OpenRepairRecord
{
    /// <summary>
    /// JSON values read the way JavaScript reads them, so this library answers exactly like the TypeScript core:
    /// a missing key and null are the same, "" is blank, false is blank, whitespace is JavaScript's whitespace.
    /// </summary>
    internal static class Js
    {
        /// <summary>JavaScript's whitespace (String.prototype.trim and \s).</summary>
        public static readonly char[] Whitespace =
        {
            '\u0009', '\u000A', '\u000B', '\u000C', '\u000D', ' ', ' ', ' ', ' ', ' ',
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            ' ', ' ', ' ', '　', '﻿',
        };

        public static string Trim(string s) => s.Trim(Whitespace);

        public static JsonNode? Get(JsonNode? node, string key) =>
            node is JsonObject o && o.TryGetPropertyValue(key, out var v) ? v : null;

        public static string? Str(JsonNode? node) =>
            node is JsonValue v && v.GetValueKind() == JsonValueKind.String ? v.GetValue<string>() : null;

        public static string? Str(JsonNode? node, string key) => Str(Get(node, key));

        /// <summary>True when nothing is written in it: null, "", whitespace, false, or containers of those.</summary>
        public static bool IsBlank(JsonNode? node)
        {
            switch (node)
            {
                case null:
                    return true;
                case JsonArray a:
                    return a.All(IsBlank);
                case JsonObject o:
                    return o.All(p => IsBlank(p.Value));
                case JsonValue v:
                    switch (v.GetValueKind())
                    {
                        case JsonValueKind.String: return Trim(v.GetValue<string>()).Length == 0;
                        case JsonValueKind.False: return true;
                        case JsonValueKind.Null: return true;
                        default: return false;
                    }
                default:
                    return false;
            }
        }

        /// <summary>JavaScript truthiness of a JSON value.</summary>
        public static bool Truthy(JsonNode? node)
        {
            switch (node)
            {
                case null:
                    return false;
                case JsonValue v:
                    switch (v.GetValueKind())
                    {
                        case JsonValueKind.String: return v.GetValue<string>().Length > 0;
                        case JsonValueKind.False: return false;
                        case JsonValueKind.Null: return false;
                        case JsonValueKind.Number: return v.GetValue<double>() != 0;
                        default: return true;
                    }
                default:
                    return true;
            }
        }

        public static JsonArray Array(JsonNode? node, string key) => Get(node, key) as JsonArray ?? new JsonArray();
    }
}
