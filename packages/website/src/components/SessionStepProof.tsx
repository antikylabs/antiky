import Image from 'next/image';

type Props = Readonly<{
  captionId: string;
}>;

export default function SessionStepProof({ captionId }: Props) {
  return (
    <figure className="session-step-proof wrap" aria-labelledby={captionId}>
      <div className="session-step-frames">
        <div>
          <Image
            src="/media/machinery/studio-pause-wide-v1.webp"
            alt="Antiky Studio paused at completed simulation step 37170 with the running game and published hierarchy visible"
            width={1223}
            height={502}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <span>Paused · completed step 37170</span>
        </div>
        <div>
          <Image
            src="/media/machinery/studio-step-wide-v1.webp"
            alt="The same Antiky Studio session paused after one bounded step at completed simulation step 37171"
            width={1224}
            height={502}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <span>One step later · completed step 37171</span>
        </div>
      </div>
      <figcaption id={captionId}>
        <span>Current Studio proof</span>
        One bounded control advances the same project session by exactly one completed step.
      </figcaption>
    </figure>
  );
}
