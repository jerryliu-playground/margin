import { DocumentListPage } from './pages/DocumentListPage';
import { DocumentPage } from './pages/DocumentPage';
import { useRoute } from './router';

export function App() {
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
