import env from "./env.ts";
import { type Item, listLatestChannelVideos } from "./youtube.ts";

if (import.meta.main) {
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

    await kv.set(videosKey, allVideos);
    await kv.set(lastVideoKey, allVideos[0].id.videoId);

    console.log(channelId, "videos updated! Total videos:", allVideos.length);
  }
}
