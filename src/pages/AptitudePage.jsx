import useLangStore from '../store/langStore';

export default function AptitudePage() {
  const { lang } = useLangStore();
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold mb-2">
        {lang === 'kr' ? '적성 검사' : 'Aptitude Test'}
      </h2>
      <p className="text-gray-500">
        {lang === 'kr' ? '준비 중입니다.' : 'Coming soon.'}
      </p>
    </div>
  );
}
