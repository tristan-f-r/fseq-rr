export function executeProgram(programName: string): Deno.ChildProcess {
  const command = new Deno.Command(
    programName,
    {
      stdin: "piped",
      stderr: "piped",
      stdout: "null",
    },
  );
  return command.spawn();
}

export async function readReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array> {
  const { value } = await reader.read();
  return value ?? new Uint8Array();
}
