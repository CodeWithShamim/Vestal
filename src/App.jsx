import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import Landing from './pages/Landing.jsx';
import Explore from './pages/Explore.jsx';
import TokenDetail from './pages/TokenDetail.jsx';
import Launch from './pages/Launch.jsx';
import Docs from './pages/Docs.jsx';
import Portfolio from './pages/Portfolio.jsx';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <ScrollToTop />
      <Nav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/token/:id" element={<TokenDetail />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
