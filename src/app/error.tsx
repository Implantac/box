"use client";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="not-found-page"><span className="eyebrow">UMA PAUSA NA EXPERIÊNCIA</span><h2>Não foi possível carregar esta etapa.</h2><p>Você pode tentar novamente. Não houve confirmação de alteração por esta tela.</p><button className="btn btn-gold" onClick={reset}>Tentar novamente</button></main>}
