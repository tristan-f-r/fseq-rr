import { FRAME_MS, PIXELS } from "./lib/constants.ts";
import { executeProgram, readReader } from "./lib/exec.ts";
import { createFSEQHeader, writeFSEQHeader } from "./lib/frame.ts";
import { FRAME_MESSAGE } from "./lib/messages.ts";

const executable = Deno.args[0];
const frameCount = parseInt(Deno.args[1]);

const stdoutWriter = Deno.stdout.writable.getWriter();

const header = createFSEQHeader(FRAME_MS, frameCount, PIXELS)
writeFSEQHeader(header, stdoutWriter);

const program = executeProgram(executable);
const writer = program.stdin.getWriter();
const reader = program.stderr.getReader();

for (let i = 0; i < frameCount; i++) {
    await writer.write(FRAME_MESSAGE);
    await stdoutWriter.write(await readReader(reader));
}

writer.releaseLock();
reader.releaseLock();
stdoutWriter.releaseLock();
program.kill();
