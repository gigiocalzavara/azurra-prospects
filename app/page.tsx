const modules = [
  ["Instagram", "Pesquisa e organização de perfis públicos com regras de conformidade."],
  ["Créditos", "Livro-razão independente, rastreável e idempotente."],
  ["Clock Engine", "Execução controlada de tarefas, iniciando em shadow mode."],
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">AZURRA TECH</div>
        <h1>Azurra Prospects</h1>
        <p>Encontre oportunidades, organize sinais públicos e envie os prospects certos para o Azurra Leads.</p>
        <div className="status"><span /> Base técnica em construção</div>
        <p><a className="primary-button inline-button" href="/login">Acessar plataforma</a></p>
      </section>
      <section className="grid" aria-label="Módulos iniciais">
        {modules.map(([title, description]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
