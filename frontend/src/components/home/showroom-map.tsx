/** Google Maps frame. The pin comes from the address query inside `src`. */
export function ShowroomMap({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      className="showroom-map"
      src={src}
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
