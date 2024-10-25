import env from "./env.ts";
import { join } from "@std/path";
import { exists } from "@std/fs";
import {
  getVideoTranscript,
  type Item,
  listLatestChannelVideos,
} from "./youtube.ts";

if (import.meta.main) {
  const dataPath = join("data");
  const kv = await Deno.openKv();

  for (const channelId of env.YOUTUBE_CHANNEL_IDS) {
    const videosKey = [channelId, "videos"];
    const lastVideoKey = [channelId, "lastVideoId"];

    const lastVideoId = await kv.get<string>(lastVideoKey);

    const latestVideos = await listLatestChannelVideos(
      channelId,
      lastVideoId.value,
    );

    const existingVideos = await kv.get<Item[]>(videosKey);

    const videoIds = (existingVideos.value || []).reduce((ids, item) => {
      ids.add(item.id.videoId);
      return ids;
    }, new Set<string>());

    const newVideos = latestVideos.filter((item) =>
      !videoIds.has(item.id.videoId)
    );

    console.log(channelId, "total new videos:", newVideos.length);

    const allVideos = newVideos.concat(existingVideos.value || []);

    for (const video of allVideos) {
      const { videoId } = video.id;
      const videoPath = join(dataPath, videoId);
      await Deno.mkdir(videoPath, {
        recursive: true,
      });

      const captionsXMLPath = join(videoPath, "captions.xml");
      const captionsSRTPath = join(videoPath, "captions.srt");
      const captionsExist = (await Promise.all([
        exists(captionsXMLPath),
        exists(captionsSRTPath),
      ])).every((v) => v);

      if (!captionsExist) {
        console.log("Getting transcript for:", videoId);
        try {
          const { srt, xml } = await getVideoTranscript(videoId);
          await Deno.writeTextFile(captionsXMLPath, xml);
          await Deno.writeTextFile(captionsSRTPath, srt);
        } catch (error) {
          console.error(error);
        }
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 5000 + (Math.random() * 5000));
      });
    }

    await kv.set(videosKey, allVideos);
    await kv.set(lastVideoKey, allVideos[0].id.videoId);

    console.log(channelId, "videos updated! Total videos:", allVideos.length);
  }
}
