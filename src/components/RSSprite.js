import React, { useState, useEffect } from "react";
import { CImage } from "@coreui/react";

const buildImageUrl = (id, width, height, keepAspectRatio) => {
  let url = `http://127.0.0.1:8090/public/sprite/${id}`;
  const params = new URLSearchParams();

  if (width) params.append("width", width);
  if (height) params.append("height", height);
  if (typeof keepAspectRatio !== "undefined") params.append("keepAspectRatio", keepAspectRatio);

  return params.toString() ? `${url}?${params.toString()}` : url;
};

const RSSprite = ({ id, width, height, keepAspectRatio = true, rounded = false, thumbnail = false, onClick }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const maxRetries = 3;
  const retryDelay = 2000;

  useEffect(() => {
    const imageUrl = buildImageUrl(id, width, height, keepAspectRatio);

    const fetchImage = () => {
      setLoading(true);

      fetch(imageUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load image from ${imageUrl}`);
          return response.blob();
        })
        .then((blob) => {
          setImageSrc(URL.createObjectURL(blob));
          setError(null);
        })
        .catch((err) => {
          setError(err.message);
          if (retryCount < maxRetries) {
            setTimeout(() => setRetryCount((prev) => prev + 1), retryDelay);
          }
        })
        .finally(() => setLoading(false));
    };

    fetchImage();
  }, [id, width, height, keepAspectRatio, retryCount]);

  const copyIconUrl = () => {
    navigator.clipboard.writeText(buildImageUrl(id, width, height, keepAspectRatio));
    alert("Icon URL copied to clipboard!");
  };

  if (error && retryCount >= maxRetries) return <div>Error loading image</div>;
  if (loading) return <div>Loading...</div>;

  return (
    <CImage
      src={imageSrc}
      alt={`Sprite ${id}`}
      rounded={rounded}
      thumbnail={thumbnail}
      onClick={onClick}
      style={{
        width: width ? `${width}px` : "auto",
        height: height ? `${height}px` : "auto",
        objectFit: keepAspectRatio ? "contain" : "fill",
        cursor: onClick ? "pointer" : "default",
      }}
      loading="lazy"
    />
  );
};

export default RSSprite;
