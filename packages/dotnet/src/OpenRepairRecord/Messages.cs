using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace OpenRepairRecord
{
    /// <summary>Copy-ready texts (WhatsApp, SMS, e-mail) that ask for the parts a record is missing.</summary>
    internal static class Messages
    {
        private static readonly Regex Runs = new Regex("[" + Regex.Escape(new string(Js.Whitespace)) + "]+");
        private static readonly Regex TrailingStops = new Regex("[.!]+$");

        private static string Short(string? text, int max = 60)
        {
            if (string.IsNullOrEmpty(text)) return "";
            var t = TrailingStops.Replace(Js.Trim(Runs.Replace(text!, " ")), "");
            // .NET strings count UTF-16 code units, exactly like JavaScript's length and slice.
            return t.Length > max ? t.Substring(0, max - 1).TrimEnd(Js.Whitespace) + "…" : t;
        }

        private static string JobRef(JsonNode r)
        {
            var id = Js.Str(r, "id");
            var location = Js.Str(Js.Get(r, "context"), "location");
            var parts = new[] { !string.IsNullOrEmpty(id) ? $"job {id}" : "the job", !string.IsNullOrEmpty(location) ? $"at {location}" : "" };
            return string.Join(" ", parts.Where(p => p.Length > 0));
        }

        private static JsonNode? LatestWork(JsonNode r) => Js.Array(r, "work").Where(w => !Js.IsBlank(w)).LastOrDefault();

        public static string ContractorRequest(JsonNode r)
        {
            var last = LatestWork(r);
            var name = Js.Str(Js.Get(last, "by"), "name");
            var first = string.IsNullOrEmpty(name) ? null : name!.Split(' ')[0];
            var asks = new List<string>();
            if (last == null || Js.IsBlank(Js.Get(last, "done"))) asks.Add("what you did");
            if (last == null || Js.IsBlank(Js.Get(last, "diagnosis"))) asks.Add("what caused it, if you know");
            if (!Js.Array(r, "checks").Any(c => !Js.IsBlank(c))) asks.Add("how you checked that it works (a test, a measurement or a photo)");
            var outcome = Js.Str(last, "outcome");
            var unfinished = last != null && (outcome == "temporary_fix" || outcome == "partial" || Js.Truthy(Js.Get(last, "follow_up_needed")));
            if (last == null || (unfinished && !Js.Array(r, "open_items").Any(o => !Js.IsBlank(o)))) asks.Add("anything still left to do, and when");
            var greeting = $"Hello{(string.IsNullOrEmpty(first) ? "" : " " + first)},";
            var symptomText = Js.Str(Js.Get(r, "context"), "symptom");
            var symptom = !string.IsNullOrEmpty(symptomText) ? $" (\"{Short(symptomText)}\")" : "";
            if (asks.Count == 0) return $"{greeting} thank you for the report on {JobRef(r)}{symptom}. I have everything I need.";
            var lines = new List<string> { $"{greeting} about {JobRef(r)}{symptom}, could you please send me:" };
            lines.AddRange(asks.Select((a, i) => $"{i + 1}. {a}"));
            lines.Add("Thank you.");
            return string.Join("\n", lines);
        }

        public static string ResidentRequest(JsonNode r)
        {
            var last = LatestWork(r);
            var by = Js.Get(last, "by");
            var company = Js.Str(by, "company");
            var name = Js.Str(by, "name");
            var who = !string.IsNullOrEmpty(company) ? company : !string.IsNullOrEmpty(name) ? name : "The contractor";
            var at = Js.Str(last, "at");
            var when = !string.IsNullOrEmpty(at) ? $" on {Labels.FormatDate(at)}" : "";
            var context = Js.Get(r, "context");
            var symptomText = Js.Str(context, "symptom");
            var about = !string.IsNullOrEmpty(symptomText) ? $"your report \"{Short(symptomText)}\"" : "your repair request";
            var location = Js.Str(context, "location");
            var where = !string.IsNullOrEmpty(location) ? $" ({location})" : "";
            return string.Join("\n", new[]
            {
                $"Hello, about {about}{where}: {who} reports the work was done{when}.",
                "Is the problem solved? Please reply 1 for yes or 2 for no. You can also tell us in your own words.",
            });
        }
    }
}
