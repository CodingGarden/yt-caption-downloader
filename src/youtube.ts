import env from "./env.ts";

export interface YouTubeSearchResponse {
  kind: string;
  etag: string;
  nextPageToken: string;
  regionCode: string;
  pageInfo: PageInfo;
  items: Item[];
}

export interface Item {
  kind: ItemKind;
  etag: string;
  id: ID;
}

export interface ID {
  kind: IDKind;
  videoId: string;
}

export enum IDKind {
  YoutubeVideo = "youtube#video",
}

export enum ItemKind {
  YoutubeSearchResult = "youtube#searchResult",
}

export interface PageInfo {
  totalResults: number;
  resultsPerPage: number;
}

export interface YouTubeResponseError {
  error: {
    message: string;
  };
}

export async function listLatestChannelVideos(
  channelId: string,
  lastVideoId: string | null,
  nextPageToken?: string,
  results: Item[] = [],
) {
  const params = new URLSearchParams({
    key: env.YOUTUBE_API_KEY,
    type: "video",
    maxResults: "50",
    channelId,
    order: "date",
  });
  if (nextPageToken) {
    params.append("pageToken", nextPageToken);
  }
  // TODO: possibly use playlist API
  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
  const response = await fetch(url);
  if (response.ok) {
    const result = (await response.json()) as YouTubeSearchResponse;
    if (
      !result.nextPageToken ||
      result.items.find((item) => item.id.videoId === lastVideoId)
    ) {
      return results.concat(result.items);
    }
    return listLatestChannelVideos(
      channelId,
      lastVideoId,
      result.nextPageToken,
      results.concat(result.items),
    );
  }
  const errorJson = (await response.json()) as YouTubeResponseError;
  console.error(errorJson);
  throw new Error(errorJson.error.message);
}
