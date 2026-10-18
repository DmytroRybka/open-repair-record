using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using OpenRepairRecord;
using Xunit;

// The shared vectors (vectors/orr-1.0.json, generated from the TypeScript core) must give the same answers here.
public class VectorTests
{
    private static readonly JsonObject Vectors = Load();

    private static JsonObject Load()
    {
        var dir = new DirectoryInfo(System.AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "vectors", "orr-1.0.json"))) dir = dir.Parent;
        return (JsonObject)JsonNode.Parse(File.ReadAllText(Path.Combine(dir!.FullName, "vectors", "orr-1.0.json")))!;
    }

    public static IEnumerable<object[]> Records() => ((JsonArray)Vectors["records"]!).Select((_, i) => new object[] { i });
    public static IEnumerable<object[]> Texts() => ((JsonArray)Vectors["texts"]!).Select((_, i) => new object[] { i });

    private static List<string> Strings(JsonNode? array) => ((JsonArray)array!).Select(x => x!.GetValue<string>()).ToList();

    private static JsonObject AsJson(Finding f)
    {
        var o = new JsonObject { ["code"] = f.Code, ["level"] = f.Level, ["section"] = f.Section, ["message"] = f.Message };
        if (f.Index != null) o["index"] = f.Index.Value;
        return o;
    }

    [Theory]
    [MemberData(nameof(Records))]
    public void Record(int i)
    {
        var c = Vectors["records"]![i]!;
        var name = c["name"]!.GetValue<string>();
        var input = c["input"]?.DeepClone();
        var v = Orr.Validate(input);
        Assert.True(c["valid"]!.GetValue<bool>() == v.Ok, name);
        Assert.Equal(Strings(c["errors"]), v.Errors.OrderBy(e => e, System.StringComparer.Ordinal).ToList());
        if (!v.Ok) return;

        var findings = new JsonArray(Orr.Check(input!).Select(f => (JsonNode)AsJson(f)).ToArray());
        Assert.True(JsonNode.DeepEquals(c["findings"], findings), $"{name}: {findings.ToJsonString()}");
        Assert.Equal(c["contractor_request"]!.GetValue<string>(), Orr.ContractorRequest(input!));
        Assert.Equal(c["resident_request"]!.GetValue<string>(), Orr.ResidentRequest(input!));
        var cleaned = Orr.Clean(input!);
        Assert.True(JsonNode.DeepEquals(c["clean"], cleaned), $"{name}: {cleaned.ToJsonString()}");
        Assert.Equal(((JsonObject)c["clean"]!).Select(p => p.Key).ToList(), cleaned.Select(p => p.Key).ToList());
    }

    [Theory]
    [MemberData(nameof(Texts))]
    public void Text(int i)
    {
        var c = Vectors["texts"]![i]!;
        var result = Orr.Parse(c["text"]!.GetValue<string>());
        Assert.Equal(c["ok"]!.GetValue<bool>(), result.Record != null);
        Assert.Equal(Strings(c["errors"]), result.Errors.OrderBy(e => e, System.StringComparer.Ordinal).ToList());
        if (result.Record != null) Assert.Equal(c["orr_version"]!.GetValue<string>(), result.Record["orr_version"]!.GetValue<string>());
    }

    [Fact]
    public void The_empty_record_is_valid_and_the_schema_is_embedded()
    {
        Assert.True(Orr.Validate(Orr.EmptyRecord()).Ok);
        Assert.Equal("Open Repair Record 1.0", Orr.Schema["title"]!.GetValue<string>());
    }
}
