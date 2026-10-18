using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;

namespace OpenRepairRecord
{
    /// <summary>One thing the check found: a contradiction, a missing part, or a tip.</summary>
    public sealed class Finding
    {
        public Finding(string code, string level, string section, string message, int? index)
        {
            Code = code; Level = level; Section = section; Message = message; Index = index;
        }

        /// <summary>A stable identifier, e.g. "confirmed-without-yes".</summary>
        public string Code { get; }
        /// <summary>"contradiction", "warning" (a missing part) or "tip".</summary>
        public string Level { get; }
        /// <summary>The part of the record: context, work, checks, evidence, resident, open_items, closure, history.</summary>
        public string Section { get; }
        public string Message { get; }
        /// <summary>For entries in a list, which one, counted from 0.</summary>
        public int? Index { get; }
    }

    /// <summary>
    /// Check a report: the same rules, codes and messages as the editor. It reads only what is written: it never judges
    /// the work, never asks for a photo, and never turns silence into a confirmation.
    /// </summary>
    internal static class Checks
    {
        private static readonly HashSet<string> EndsTheJob = new HashSet<string> { "duplicate", "cancelled" };
        private static readonly Dictionary<string, int> Rank = new Dictionary<string, int> { ["contradiction"] = 0, ["warning"] = 1, ["tip"] = 2 };

        public static IReadOnlyList<Finding> Run(JsonNode r)
        {
            var output = new List<Finding>();
            void Add(string code, string level, string section, string message, int? index = null) =>
                output.Add(new Finding(code, level, section, message, index));

            var context = Js.Get(r, "context");
            var resident = Js.Get(r, "resident");
            var closure = Js.Get(r, "closure") as JsonObject;
            var allWork = Js.Array(r, "work");
            var allChecks = Js.Array(r, "checks");
            var work = allWork.Where(w => !Js.IsBlank(w)).ToList();
            var checks = allChecks.Where(c => !Js.IsBlank(c)).ToList();
            var openItems = Js.Array(r, "open_items").Where(o => !Js.IsBlank(o)).ToList();
            var last = work.Count > 0 ? work[work.Count - 1] : null;
            var closed = Js.Str(r, "status") == "closed";
            var reason = Js.Str(closure, "reason_code");
            var endsTheJob = reason != null && EndsTheJob.Contains(reason);
            var res = Js.Str(resident, "status");
            var area = Js.Str(context, "area");
            var inUnit = (area ?? "unit") == "unit";
            var lastOutcome = Js.Str(last, "outcome");

            // Contradictions: two parts of the record say different things.
            if (closed && reason == "confirmed_by_resident" && res != "resolved")
                Add("confirmed-without-yes", "contradiction", "closure",
                    $"Closed as \"confirmed by the resident\", but the resident's answer is \"{ResidentLabel(res)}\".");
            if (closed && reason == "work_reported_done_no_reply" && res != "no_reply")
                Add("no-reply-reason-mismatch", "contradiction", "closure",
                    $"Closed as \"no reply from the resident\", but the resident's answer is \"{ResidentLabel(res)}\".");
            if (closed && res == "not_resolved" && !endsTheJob)
                Add("closed-resident-not-resolved", "contradiction", "closure",
                    "The resident says the problem is not solved, but the record is closed. Reopen it, or say why it was closed.");
            if (closed && last != null && (lastOutcome == "no_access" || lastOutcome == "not_done") && !endsTheJob)
                Add("closed-last-visit-unfinished", "contradiction", "closure",
                    $"The last visit says \"{OutcomeLabel(lastOutcome)}\", but the record is closed.");
            if (inUnit && res == "not_applicable")
                Add("not-applicable-in-unit", "warning", "resident",
                    "\"Not applicable\" is meant for common areas. For a unit, ask the resident, or say why you could not.");

            // What happened.
            if (Js.IsBlank(Js.Get(context, "symptom")))
                Add("no-symptom", "warning", "context", "Say what was reported, in the reporter's words.");
            if (Js.IsBlank(Js.Get(context, "location")))
                Add("no-location", "warning", "context", "Say where: the building and unit, or the common area.");
            if (Js.IsBlank(Js.Get(r, "id")))
                Add("no-id", "tip", "context", "Add your job or ticket number, so the report can be matched to your system.");

            // Contractor statements.
            if (work.Count == 0)
                Add("no-work", "warning", "work", "No contractor statement yet: who says what was done, and when.");
            for (var i = 0; i < allWork.Count; i++)
            {
                var w = allWork[i];
                if (Js.IsBlank(w)) continue;
                if (Js.IsBlank(Js.Get(w, "by"))) Add("work-no-by", "warning", "work", "Say who made this statement.", i);
                if (Js.IsBlank(Js.Get(w, "at"))) Add("work-no-at", "warning", "work", "Add when the work was done.", i);
                if (!Js.Truthy(Js.Get(w, "outcome"))) Add("work-no-outcome", "warning", "work", "Choose the outcome the contractor reports.", i);
                if (Js.IsBlank(Js.Get(w, "done")) && Js.Str(w, "outcome") != "no_access")
                    Add("work-no-done", "warning", "work", "Describe what was done, in the contractor's words.", i);
                if (Js.Truthy(Js.Get(w, "follow_up_needed")) && Js.IsBlank(Js.Get(w, "follow_up")))
                    Add("work-follow-up-blank", "warning", "work", "Follow-up is needed: say what it is.", i);
            }
            if (last != null && (lastOutcome == "temporary_fix" || lastOutcome == "partial" || Js.Truthy(Js.Get(last, "follow_up_needed")))
                && openItems.Count == 0)
                Add("unfinished-no-open-item", "warning", "open_items",
                    "The latest work is not a full fix. Add an open item: what is left, who owns it, and by when.");
            if (last != null && lastOutcome == "resolved" && Js.IsBlank(Js.Get(last, "diagnosis")))
            {
                var index = -1;
                for (var i = 0; i < allWork.Count; i++) if (ReferenceEquals(allWork[i], last)) index = i;
                Add("no-diagnosis", "tip", "work", "If the contractor knows the cause, add it. It helps when the fault comes back.", index);
            }

            // Checks.
            if (work.Count > 0 && checks.Count == 0 && lastOutcome != "no_access")
                Add("no-checks", "tip", "checks",
                    "No check is recorded. That is fine, but the report will show the contractor's statement only.");
            for (var i = 0; i < allChecks.Count; i++)
            {
                var c = allChecks[i];
                if (Js.IsBlank(c)) continue;
                if (Js.IsBlank(Js.Get(c, "result"))) Add("check-no-result", "warning", "checks", "Write what the check found.", i);
                if (!Js.Truthy(Js.Get(c, "by_role")) && Js.IsBlank(Js.Get(c, "by_name"))) Add("check-no-by", "warning", "checks", "Say who checked.", i);
                if (Js.IsBlank(Js.Get(c, "limits")))
                    Add("check-no-limits", "tip", "checks", "Say what the check did not cover, e.g. \"did not inspect the unit\".", i);
            }

            // Evidence.
            var evidence = Js.Array(r, "evidence");
            for (var i = 0; i < evidence.Count; i++)
            {
                if (Js.IsBlank(evidence[i])) continue;
                if (Js.IsBlank(Js.Get(evidence[i], "description"))) Add("evidence-no-description", "tip", "evidence", "Say what this item shows.", i);
            }

            // The resident.
            if (res == "no_reply" && Js.IsBlank(Js.Get(resident, "asked_at")))
                Add("no-reply-no-asked-at", "warning", "resident", "No reply: add when the resident was asked.");
            if (res == "pending" && Js.IsBlank(Js.Get(resident, "asked_at")))
                Add("pending-no-asked-at", "warning", "resident", "Waiting for an answer: add when the resident was asked.");
            if ((res == "resolved" || res == "not_resolved") && Js.IsBlank(Js.Get(resident, "words")))
                Add("answer-no-words", "tip", "resident", "Quote the resident's own words.");
            if ((res == "resolved" || res == "not_resolved") && Js.IsBlank(Js.Get(resident, "answered_at")))
                Add("answer-no-date", "tip", "resident", "Add when the resident answered.");

            // Open items.
            var allOpen = Js.Array(r, "open_items");
            for (var i = 0; i < allOpen.Count; i++)
            {
                var o = allOpen[i];
                if (Js.IsBlank(o)) continue;
                if (Js.IsBlank(Js.Get(o, "what"))) Add("open-item-no-what", "warning", "open_items", "Say what is still open.", i);
                if (Js.IsBlank(Js.Get(o, "owner")) || Js.IsBlank(Js.Get(o, "due")))
                    Add("open-item-no-owner", "tip", "open_items", "Give this open item an owner and a date.", i);
            }

            // Closure.
            if (closed)
            {
                var c = closure ?? new JsonObject();
                if (Js.IsBlank(Js.Get(c, "closed_by"))) Add("closed-no-by", "warning", "closure", "Say who closed the record.");
                if (Js.IsBlank(Js.Get(c, "closed_at"))) Add("closed-no-at", "warning", "closure", "Add when the record was closed.");
                var code = Js.Str(c, "reason_code");
                if (!Js.Truthy(Js.Get(c, "reason_code")))
                    Add("closed-no-reason", "warning", "closure", "Choose why the record was closed.");
                else if ((code == "administrative" || code == "other") && Js.IsBlank(Js.Get(c, "reason")))
                    Add("closed-reason-blank", "warning", "closure", "Explain the reason in a sentence.");
                if (!endsTheJob && res == "pending")
                    Add("closed-while-pending", "warning", "closure", "Closed while still waiting for the resident's answer.");
                if (!endsTheJob && inUnit && res == "not_asked")
                    Add("closed-not-asked", "warning", "closure",
                        "Closed without asking the resident. If you could not ask, say why in the reason.");
                if (!endsTheJob && openItems.Count > 0)
                    Add("closed-with-open-items", "warning", "closure",
                        $"Closed with {openItems.Count} open item{(openItems.Count == 1 ? "" : "s")}. Keep the record open, " +
                        "or say in the reason who follows them up.");
            }

            // History.
            var history = Js.Array(r, "history");
            for (var i = 0; i < history.Count; i++)
            {
                var h = history[i];
                if (Js.IsBlank(h)) continue;
                if (Js.IsBlank(Js.Get(h, "text")) && Js.Str(h, "kind") != "reopened")
                    Add("history-no-text", "warning", "history", "Write what this later entry says.", i);
                if (Js.IsBlank(Js.Get(h, "at"))) Add("history-no-at", "warning", "history", "Add when this was added.", i);
            }

            // A stable sort by level, as in JavaScript.
            return output.Select((f, i) => (f, i)).OrderBy(x => Rank[x.f.Level]).ThenBy(x => x.i).Select(x => x.f).ToList();
        }

        public static string ResidentLabel(string? status) =>
            status != null && Labels.Resident.TryGetValue(status, out var label) ? label : "undefined";

        public static string OutcomeLabel(string? outcome) =>
            string.IsNullOrEmpty(outcome) ? "not stated" : Labels.Outcome.TryGetValue(outcome!, out var label) ? label : outcome!;
    }
}
