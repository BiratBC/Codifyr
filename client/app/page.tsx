import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
    <div>Home Page</div>
    <button>
      <Link href={'/editor/1'} className="bg-blue-600 p-2 text-white">Chat Room</Link>
    </button>
    </>
  );
}
