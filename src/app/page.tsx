import { createCaller } from "@/server/api/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  const health = await createCaller({}).health();

  return (
    <main>
      <h1>Gerenciador de tarefas</h1>
      <p>Configuração inicial do desafio técnico da Artefact.</p>
      <p>Conexão com o backend: <strong>{health.status}</strong></p>
    </main>
  );
}
