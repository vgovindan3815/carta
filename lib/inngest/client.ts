// Inngest client stub — Phase 1.2 will replace this with the real Inngest SDK.
// The stub allows routes that import inngest.send() to compile without the package installed.

type InngestEvent = { name: string; data: Record<string, unknown> };

const stub = {
  async send(event: InngestEvent): Promise<void> {
    console.warn('[inngest stub] Event queued (Inngest not yet configured):', event.name, event.data);
  },
};

export const inngest = stub;
