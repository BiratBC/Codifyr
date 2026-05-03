export default function Page({ params }: { params: { roomId: string } }) {
  return <div>Room: {params.roomId}</div>;
}