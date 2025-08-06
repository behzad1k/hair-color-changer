import HairColorChanger from '@/components/HairColorChanger';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-gray-900 text-white">
      <div className="w-full max-w-6xl">
        <HairColorChanger />
      </div>
    </main>
  );
}