export default function StatusBadge({ status }) {
  const styles = {
    Active: "bg-green-100 text-success",
    Inactive: "bg-gray-100 text-gray-500",
  };

  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] || styles.Inactive}`}>
      {status}
    </span>
  );
}