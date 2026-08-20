import React, { useEffect, useState } from 'react'

const INSTALLER_URL = 'https://ccofkrkttkjpfriomeqh.supabase.co/functions/v1/public-installer'
const RELEASE_API_URL = 'https://ccofkrkttkjpfriomeqh.supabase.co/functions/v1/public-download-api/latest'

export default function DownloadPage() {
  const [version, setVersion] = useState('1.2.5')
  const [size, setSize] = useState('Versão oficial')

  useEffect(() => {
    fetch(RELEASE_API_URL)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload?.ok || !payload?.data) return
        if (payload.data.version) setVersion(payload.data.version)
        const bytes = Number(payload.data.total_size_bytes || 0)
        if (bytes > 0) setSize(`${(bytes / 1024 / 1024).toFixed(1)} MB de componentes`)
      })
      .catch(() => {})
  }, [])

  return (
    <main className="wsp-download-page">
      <style>{`
        .wsp-download-page {
          min-height: 100vh;
          color: #e8eef5;
          background:
            radial-gradient(circle at 50% -10%, rgba(37, 211, 102, .16), transparent 34%),
            radial-gradient(circle at 92% 82%, rgba(96, 165, 250, .08), transparent 28%),
            #071018;
        }
        .wsp-download-page * { box-sizing: border-box; }
        .wsp-download-header {
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 28px;
          border-bottom: 1px solid #1d2d3a;
          background: rgba(7,16,24,.86);
          backdrop-filter: blur(18px);
        }
        .wsp-download-brand { display: flex; align-items: center; gap: 11px; text-decoration: none; }
        .wsp-download-brand img { width: 42px; height: 42px; object-fit: contain; filter: drop-shadow(0 7px 16px rgba(37,211,102,.18)); }
        .wsp-download-brand strong { font-size: 18px; letter-spacing: -.03em; color: #f7fafc; }
        .wsp-download-brand strong span { color: #25d366; }
        .wsp-download-admin { color: #8394a3; text-decoration: none; font-size: 13px; }
        .wsp-download-admin:hover { color: #e8eef5; }
        .wsp-download-wrap { width: min(1080px, calc(100% - 32px)); margin: 0 auto; padding: 76px 0 54px; }
        .wsp-download-hero { text-align: center; max-width: 780px; margin: 0 auto; }
        .wsp-download-icon {
          width: 88px; height: 88px; margin: 0 auto 24px; border-radius: 26px;
          display: grid; place-items: center; border: 1px solid #285945;
          background: linear-gradient(145deg, #102b24, #0b1e19);
          box-shadow: 0 18px 70px rgba(37,211,102,.12);
        }
        .wsp-download-icon img { width: 62px; height: 62px; object-fit: contain; }
        .wsp-download-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px;
          border: 1px solid #285945; border-radius: 999px; background: #0d241c;
          color: #8df1cb; font-size: 11px; font-weight: 800; letter-spacing: .04em;
        }
        .wsp-download-hero h1 { margin: 18px 0 12px; font-size: clamp(40px, 6vw, 66px); line-height: .98; letter-spacing: -.055em; }
        .wsp-download-hero h1 span { color: #25d366; }
        .wsp-download-hero > p { max-width: 650px; margin: 0 auto; color: #8fa0ae; font-size: 16px; line-height: 1.7; }
        .wsp-download-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          margin-top: 30px; padding: 15px 24px; min-width: 245px; border-radius: 12px;
          background: #25d366; color: #062219; text-decoration: none; font-weight: 850;
          box-shadow: 0 14px 42px rgba(37,211,102,.18); transition: .16s ease;
        }
        .wsp-download-button:hover { transform: translateY(-1px); background: #41dc7a; }
        .wsp-download-meta { margin-top: 15px; color: #667887; font-size: 11px; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .wsp-download-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 64px; }
        .wsp-download-card { border: 1px solid #1d2d3a; background: rgba(13,24,34,.82); border-radius: 16px; padding: 22px; }
        .wsp-download-card .symbol { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 11px; background: #102b24; color: #7be9c1; font-weight: 900; margin-bottom: 15px; }
        .wsp-download-card h2 { font-size: 15px; margin: 0 0 7px; }
        .wsp-download-card p { margin: 0; color: #8394a3; font-size: 12px; line-height: 1.6; }
        .wsp-download-section { display: grid; grid-template-columns: 1.25fr .75fr; gap: 16px; margin-top: 16px; }
        .wsp-download-panel { border: 1px solid #1d2d3a; background: rgba(13,24,34,.82); border-radius: 16px; padding: 25px; }
        .wsp-download-panel h2 { margin: 0 0 6px; font-size: 17px; }
        .wsp-download-panel > p { color: #8394a3; font-size: 12px; line-height: 1.55; }
        .wsp-download-steps { margin-top: 20px; display: grid; gap: 15px; }
        .wsp-download-step { display: grid; grid-template-columns: 30px 1fr; gap: 12px; align-items: start; }
        .wsp-download-step b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; background: #102b24; color: #7be9c1; font-size: 11px; border: 1px solid #285945; }
        .wsp-download-step span { color: #a6b4bf; font-size: 12px; line-height: 1.6; padding-top: 4px; }
        .wsp-download-notice { border-color: #5a481d; background: rgba(45,36,11,.72); }
        .wsp-download-notice h2 { color: #f7ca52; }
        .wsp-download-footer { border-top: 1px solid #1d2d3a; color: #61717e; text-align: center; font-size: 11px; padding: 24px 16px 34px; }
        @media (max-width: 760px) {
          .wsp-download-header { padding: 0 16px; }
          .wsp-download-admin { display: none; }
          .wsp-download-wrap { padding-top: 52px; }
          .wsp-download-grid, .wsp-download-section { grid-template-columns: 1fr; }
          .wsp-download-hero h1 { font-size: 44px; }
          .wsp-download-button { width: 100%; }
        }
      `}</style>

      <header className="wsp-download-header">
        <a className="wsp-download-brand" href="/download">
          <img src="/sender-pro-icon.png" alt="Whats Sender PRO" />
          <strong>Sender <span>Pro</span></strong>
        </a>
        <a className="wsp-download-admin" href="/">Área administrativa</a>
      </header>

      <section className="wsp-download-wrap">
        <div className="wsp-download-hero">
          <div className="wsp-download-icon"><img src="/sender-pro-icon.png" alt="" /></div>
          <div className="wsp-download-pill">✓ DOWNLOAD OFICIAL</div>
          <h1>Whats Sender <span>PRO</span></h1>
          <p>Baixe o instalador oficial para Windows. O processo verifica a integridade dos componentes antes da instalação e utiliza somente arquivos publicados no sistema oficial do Whats Sender PRO.</p>

          <a className="wsp-download-button" href={INSTALLER_URL}>↓ Baixar para Windows</a>

          <div className="wsp-download-meta">
            <span>Versão {version}</span>
            <span>{size}</span>
            <span>Windows 10/11 • 64 bits</span>
          </div>
        </div>

        <div className="wsp-download-grid">
          <article className="wsp-download-card">
            <div className="symbol">W</div>
            <h2>Windows 10 ou 11</h2>
            <p>Compatível com computadores Windows 64 bits.</p>
          </article>
          <article className="wsp-download-card">
            <div className="symbol">C</div>
            <h2>Google Chrome</h2>
            <p>Necessário para a integração com o WhatsApp Web.</p>
          </article>
          <article className="wsp-download-card">
            <div className="symbol">✓</div>
            <h2>Integridade verificada</h2>
            <p>Os arquivos baixados são conferidos por SHA-256 antes da instalação.</p>
          </article>
        </div>

        <div className="wsp-download-section">
          <article className="wsp-download-panel">
            <h2>Como instalar</h2>
            <p>O processo foi preparado para ser simples mesmo em um computador novo.</p>
            <div className="wsp-download-steps">
              <div className="wsp-download-step"><b>1</b><span>Clique em “Baixar para Windows”.</span></div>
              <div className="wsp-download-step"><b>2</b><span>Abra o instalador baixado e permita a execução caso o Windows solicite confirmação.</span></div>
              <div className="wsp-download-step"><b>3</b><span>Aguarde o download e a validação dos componentes oficiais.</span></div>
              <div className="wsp-download-step"><b>4</b><span>Abra o Whats Sender PRO, informe sua licença e conecte o WhatsApp.</span></div>
            </div>
          </article>

          <article className="wsp-download-panel wsp-download-notice">
            <h2>Aviso do Windows</h2>
            <p>Enquanto o instalador ainda não possui assinatura digital de editor, o Windows pode exibir uma confirmação de segurança. Utilize sempre o arquivo obtido por esta página oficial.</p>
          </article>
        </div>
      </section>

      <footer className="wsp-download-footer">Whats Sender PRO • Distribuição oficial</footer>
    </main>
  )
}
