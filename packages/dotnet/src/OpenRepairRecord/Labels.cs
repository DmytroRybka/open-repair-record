using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace OpenRepairRecord
{
    /// <summary>Human labels for every code, and the small formatters the messages use.</summary>
    public static class Labels
    {
        public static readonly IReadOnlyDictionary<string, string> Area = new Dictionary<string, string>
        {
            ["unit"] = "A unit", ["common_area"] = "A common area",
        };

        public static readonly IReadOnlyDictionary<string, string> Reporter = new Dictionary<string, string>
        {
            ["resident"] = "Resident", ["owner"] = "Owner", ["staff"] = "Staff", ["inspection"] = "Inspection", ["other"] = "Other",
        };

        public static readonly IReadOnlyDictionary<string, string> CheckRole = new Dictionary<string, string>
        {
            ["technician"] = "Technician", ["coordinator"] = "Coordinator", ["inspector"] = "Inspector",
            ["resident"] = "Resident", ["other"] = "Someone else",
        };

        public static readonly IReadOnlyDictionary<string, string> CheckMethod = new Dictionary<string, string>
        {
            ["test_run"] = "Test run", ["measurement"] = "Measurement", ["visual"] = "Looked at it",
            ["photo_review"] = "Reviewed a photo", ["other"] = "Other",
        };

        public static readonly IReadOnlyDictionary<string, string> Evidence = new Dictionary<string, string>
        {
            ["photo"] = "Photo", ["measurement"] = "Measurement", ["test_log"] = "Test log",
            ["certificate"] = "Certificate", ["document"] = "Document", ["other"] = "Other",
        };

        public static readonly IReadOnlyDictionary<string, string> Closure = new Dictionary<string, string>
        {
            ["confirmed_by_resident"] = "Confirmed by the resident",
            ["work_reported_done_no_reply"] = "Work reported done, no reply from the resident",
            ["administrative"] = "Closed for an administrative reason",
            ["duplicate"] = "Duplicate of another record",
            ["cancelled"] = "Cancelled",
            ["other"] = "Other reason",
        };

        public static readonly IReadOnlyDictionary<string, string> History = new Dictionary<string, string>
        {
            ["resident_reply"] = "Resident replied", ["revisit"] = "Revisit", ["correction"] = "Correction",
            ["reopened"] = "Reopened", ["note"] = "Note",
        };

        public static readonly IReadOnlyDictionary<string, string> Resident = new Dictionary<string, string>
        {
            ["resolved"] = "Resolved", ["not_resolved"] = "Not resolved", ["not_asked"] = "Not asked yet",
            ["pending"] = "Asked, waiting for an answer", ["no_reply"] = "No reply", ["not_applicable"] = "Not applicable",
        };

        public static readonly IReadOnlyDictionary<string, string> Outcome = new Dictionary<string, string>
        {
            ["resolved"] = "Resolved", ["temporary_fix"] = "Temporary fix", ["partial"] = "Partly done",
            ["not_done"] = "Not done", ["no_access"] = "No access",
        };

        private static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
        private static readonly Regex DateRe = new Regex(@"^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?", RegexOptions.ECMAScript);

        /// <summary>"2026-10-12T14:20" becomes "12 Oct 2026, 14:20". Shown as written: no time zone conversion.</summary>
        public static string FormatDate(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            var m = DateRe.Match(value!);
            if (!m.Success) return value!;
            var month = int.Parse(m.Groups[2].Value);
            var name = month >= 1 && month <= 12 ? Months[month - 1] : m.Groups[2].Value;
            var date = $"{int.Parse(m.Groups[3].Value)} {name} {m.Groups[1].Value}";
            return m.Groups[4].Success ? $"{date}, {m.Groups[4].Value}:{m.Groups[5].Value}" : date;
        }

        /// <summary>"Ravi Kumar, Bluepoint Cooling (AC technician)".</summary>
        public static string PersonLabel(JsonNode? person)
        {
            if (person == null) return "";
            var parts = new List<string>();
            var name = Js.Str(person, "name");
            var company = Js.Str(person, "company");
            if (!string.IsNullOrEmpty(name)) parts.Add(name!);
            if (!string.IsNullOrEmpty(company)) parts.Add(company!);
            var head = string.Join(", ", parts);
            var role = Js.Str(person, "role");
            if (!string.IsNullOrEmpty(role)) return head.Length > 0 ? $"{head} ({role})" : role!;
            return head;
        }
    }
}
