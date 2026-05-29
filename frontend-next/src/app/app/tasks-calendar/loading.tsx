export default function TasksCalendarLoading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="h-32 rounded-[20px] bg-gray-200 dark:bg-gray-700 mb-6" />
      <div className="flex gap-2 mb-6">
        <div className="h-12 w-32 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-12 w-36 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 h-96 rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="lg:col-span-3 h-96 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}
