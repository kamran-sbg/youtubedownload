const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");
const path = require("path");
const app = express();
const port = process.env.PORT || 5000; // Render PORT env var ko use karega

// Middleware
app.use(
  cors({
    origin: ["https://visionary-palmier-01269c.netlify.app/", "http://localhost:5000"], // Replace with your Netlify URL
    methods: ["GET", "POST"],
  })
);
app.use(express.json());

// Serve frontend (optional, only for local testing)
app.use(express.static(path.join(__dirname, "../frontend")));

// Get video title endpoint
app.post("/get-title", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    console.error("No video ID provided for title");
    return res.status(400).json({ error: "Video ID is required" });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching title for ID: ${videoId}`);

    if (!ytdl.validateID(videoId)) {
      console.error("Invalid video ID:", videoId);
      return res.status(400).json({ error: "Invalid video ID" });
    }

    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: { timeout: 15000 },
    });
    const videoTitle = info.videoDetails.title || `Video ${videoId}`;
    console.log(`Title fetched: ${videoTitle}`);

    res.json({ title: videoTitle });
  } catch (error) {
    console.error("Error fetching title:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "Failed to fetch title", details: error.message });
  }
});

// Download endpoint
app.post("/download", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    console.error("No video ID provided");
    return res.status(400).json({ error: "Video ID is required" });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching video info for ID: ${videoId}`);

    if (!ytdl.validateID(videoId)) {
      console.error("Invalid video ID:", videoId);
      return res.status(400).json({ error: "Invalid video ID" });
    }

    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: { timeout: 15000 },
    });
    console.log("Video info fetched successfully:", info.videoDetails.title);

    let format;
    try {
      format = ytdl.chooseFormat(info.formats, {
        quality: "highestvideo",
        filter: (format) =>
          format.container === "mp4" && format.hasVideo && format.hasAudio,
      });
    } catch (formatError) {
      console.warn(
        "Highest video format failed, trying fallbacks:",
        formatError.message
      );
      try {
        format = ytdl.chooseFormat(info.formats, {
          filter: (format) =>
            format.container === "mp4" && format.hasVideo && format.hasAudio,
        });
      } catch (fallbackError) {
        console.warn(
          "First fallback failed, trying any mp4:",
          fallbackError.message
        );
        format = ytdl.chooseFormat(info.formats, {
          filter: (format) => format.container === "mp4",
        });
      }
    }

    if (!format) {
      console.error("No suitable format found for video ID:", videoId);
      return res.status(400).json({ error: "No suitable video format found" });
    }

    const videoTitle =
      info.videoDetails.title.replace(/[^\w\s]/gi, "") || `video_${videoId}`;
    console.log(`Streaming video: ${videoTitle}`);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${videoTitle}.mp4"`
    );
    res.setHeader("Content-Type", "video/mp4");

    const stream = ytdl(videoUrl, { format });
    stream.on("error", (streamError) => {
      console.error("Stream error:", streamError.message);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Stream failed", details: streamError.message });
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Error in /download endpoint:", error.message, error.stack);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Failed to download video", details: error.message });
    }
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "Server is running" });
});

app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});
