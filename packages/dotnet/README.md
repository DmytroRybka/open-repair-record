# OpenRepairRecord (.NET)

Read, validate and check [Open Repair Record](https://openrepairrecord.com) 1.0 files: what a completed repair actually
means. For .NET 8+ and, through .NET Standard 2.0, .NET Framework 4.6.2+ (the integrations with Dynamics, Yardi or a
CAFM that often still run there).

The same rules, codes and messages as the editor at openrepairrecord.com and the TypeScript and Python libraries: all
of them pass the same shared test vectors.

```
dotnet add package OpenRepairRecord
```

```csharp
using OpenRepairRecord;

var result = Orr.Parse(File.ReadAllText("Q-1204.orr.json"));
if (result.Record is null)
{
    foreach (var e in result.Errors) Console.WriteLine(e);   // e.g. resident.status: must be one of ...
}
else
{
    foreach (var f in Orr.Check(result.Record))              // contradictions, missing parts, tips
        Console.WriteLine($"{f.Level} {f.Section} {f.Index} {f.Message}");
    Console.WriteLine(Orr.ResidentRequest(result.Record));   // a neutral yes/no question for the resident
}
```

Also: `Orr.Validate(JsonNode)`, `Orr.Clean(record)` (drops what nobody wrote, stable key order), `Orr.EmptyRecord()`,
`Orr.ContractorRequest(record)`, `Orr.FormatDate`, `Labels` for every code, `Orr.Version`, `Orr.SchemaUrl` and
`Orr.Schema` (the JSON Schema, embedded). Records are `System.Text.Json` nodes, exactly as parsed; no reflection, no
code generation at runtime.

No reply stays no reply; a closure "confirmed by the resident" needs the resident's yes; a temporary fix needs an open
item; a photo is never required. The rules: [openrepairrecord.com/format/](https://openrepairrecord.com/format/).

MIT. Initiated by the [PMFriend](https://pmfriend.com/) team.
