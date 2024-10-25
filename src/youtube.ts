import env from "./env.ts";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { unescape } from "@std/html/entities";

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

const requestHeaders = {
  Host: "www.youtube.com",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

function secondsToTimestamp(totalSeconds: number) {
  const milliseconds = Math.floor((totalSeconds % 1) * 1000);
  totalSeconds = Math.floor(totalSeconds);
  let remainingSeconds = totalSeconds;
  const seconds = totalSeconds % 60;
  remainingSeconds = totalSeconds - seconds;
  const minutes = Math.floor((remainingSeconds / 60) % 60);
  remainingSeconds = remainingSeconds - (minutes * 60);
  const hours = Math.floor(remainingSeconds / 3600);

  const pad = (value: number, amount = 2) =>
    value.toString().padStart(amount, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${
    pad(milliseconds, 3)
  }`;
}

export async function getVideoTranscript(videoId: string) {
  const youtubeVideoUrl = `https://youtube.com/watch?v=${videoId}`;
  const response = await fetch(youtubeVideoUrl, {
    headers: requestHeaders,
  });
  const html = await response.text();
  let captionsText = "";
  try {
    captionsText = html.split('"captions":')[1].split(',"videoDetails')[0];
  } catch {
    throw new Error(`No captions found: ${videoId}`);
  }
  const captionsMetaJSON = JSON.parse(captionsText);
  const { baseUrl } =
    captionsMetaJSON.playerCaptionsTracklistRenderer.captionTracks[0];
  const captionsResponse = await fetch(baseUrl, {
    headers: {
      ...requestHeaders,
      Referer: youtubeVideoUrl,
    },
  });
  const xml = await captionsResponse.text();
  const doc = new DOMParser().parseFromString(
    xml,
    "text/html",
  );
  const captions: {
    start: number;
    duration: number;
    text: string;
    end: number;
  }[] = [];
  doc.querySelectorAll("text").forEach((element) => {
    const start = Number(element.getAttribute("start"));
    const duration = Number(element.getAttribute("dur"));
    const text = unescape(element.textContent);
    captions.push({
      start,
      duration,
      text,
      end: start + duration,
    });
  });
  let srt = "";
  captions.forEach(({ start, end, text }, index) => {
    const nextCaption = captions[index + 1];
    const endSeconds = index < captions.length - 1 && nextCaption.start < end
      ? nextCaption.start
      : end;
    srt += `${index + 1}
${secondsToTimestamp(start)} --> ${secondsToTimestamp(endSeconds)}
${text}

`;
  });
  return { xml, srt };
}
