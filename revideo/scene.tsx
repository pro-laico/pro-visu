import { Circle, Rect, Video, makeScene2D } from "@revideo/2d";
import { createRef, useScene, waitFor } from "@revideo/core";

/**
 * Composites the captured site video into a browser-window mockup, centered on a colored
 * backdrop. All inputs come from render variables so the generator can parameterize it.
 */
export default makeScene2D("deviceFrame", function* (view) {
  const videoSrc = useScene().variables.get("videoSrc", "")() as string;
  const durationSeconds = useScene().variables.get("durationSeconds", 6)() as number;
  const background = useScene().variables.get("background", "#0b0b0f")() as string;
  const videoWidth = useScene().variables.get("videoWidth", 1280)() as number;

  const video = createRef<Video>();

  view.add(
    <Rect
      width={"100%"}
      height={"100%"}
      fill={background}
      layout
      justifyContent={"center"}
      alignItems={"center"}
    >
      <Rect
        fill={"#1b1b22"}
        radius={24}
        stroke={"#2c2c36"}
        lineWidth={2}
        layout
        direction={"column"}
        clip
      >
        {/* Title bar with traffic-light dots */}
        <Rect height={52} fill={"#23232c"} layout alignItems={"center"} paddingLeft={22} gap={12}>
          <Circle size={15} fill={"#ff5f57"} />
          <Circle size={15} fill={"#febc2e"} />
          <Circle size={15} fill={"#28c840"} />
        </Rect>
        {/* Viewport */}
        <Rect clip layout>
          <Video ref={video} src={videoSrc} width={videoWidth} play />
        </Rect>
      </Rect>
    </Rect>,
  );

  yield* waitFor(durationSeconds);
});
