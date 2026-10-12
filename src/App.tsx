import './App.css'

function App() {
  return (
    <main className="page">
      <header className="brand"><span className="brand-mark" aria-hidden="true">A</span> Approvia</header>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Institutional approval management</p>
        <h1 id="page-title">A clearer path<br />to every approval.</h1>
        <p className="description">A central place for students and faculty to manage requests, follow approval progress, and keep a record of every decision.</p>
        <div className="status"><span aria-hidden="true" />Application under development</div>
        <p className="note">Login, request submission, and approval processing will be available in a future release.</p>
      </section>
      <footer>Approvia · Institutional Digital Approval Management System</footer>
    </main>
  )
}

export default App
