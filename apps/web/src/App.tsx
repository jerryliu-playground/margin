import { DocumentListPage } from './pages/DocumentListPage';
import { DocumentPage } from './pages/DocumentPage';
import { useRoute } from './router';

function Page() {
  const route = useRoute();
  switch (route.name) {
    case 'list':
      return <DocumentListPage />;
    case 'document':
      return <DocumentPage key={route.id} id={route.id} />;
    case 'not-found':
      return (
        <main className="page">
          <h1>Page not found</h1>
          <a href="#/">All documents</a>
        </main>
      );
  }
}

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="topbar__brand">
          <span className="topbar__mark" aria-hidden="true" />
          Margin
        </a>
      </header>
      <Page />
    </div>
  );
}
