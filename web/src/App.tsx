import { AccentButton } from './ui/AccentButton';
import { Eyebrow } from './ui/Eyebrow';

export default function App() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-6">
      <Eyebrow>Riptide</Eyebrow>
      <h1 className="text-4xl font-extrabold text-ink">Foundation</h1>
      <AccentButton>Ready</AccentButton>
    </main>
  );
}
