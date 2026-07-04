import { describe, expect, it } from "vitest";
import {
  runWeComCatchCommand,
  WECOMCATCH_SCRIPT_PATH,
  type WeComCatchExecFile,
} from "@/services/wecomcatch-service";

describe("wecomcatch-service", () => {
  it("calls the fixed wrapper script and parses JSON stdout", async () => {
    const execFileImpl: WeComCatchExecFile = (file, args, _options, callback) => {
      expect(file).toBe(WECOMCATCH_SCRIPT_PATH);
      expect(args).toEqual(["status"]);
      callback(null, "{\"complete\":444,\"pending\":3}", "");
    };

    const result = await runWeComCatchCommand("status", { execFileImpl });
    expect(result).toMatchObject({
      command: "status",
      scriptPath: WECOMCATCH_SCRIPT_PATH,
      parsed: { complete: 444, pending: 3 },
    });
  });

  it("rejects failed commands with captured stdout and stderr", async () => {
    const execFileImpl: WeComCatchExecFile = (_file, _args, _options, callback) => {
      const error = Object.assign(new Error("boom"), { code: 2 });
      callback(error, "partial", "failed clearly");
    };

    await expect(runWeComCatchCommand("export", { execFileImpl })).rejects.toMatchObject({
      message: "failed clearly",
      result: expect.objectContaining({ stdout: "partial", stderr: "failed clearly" }),
    });
  });
});
