import React, { useState, useEffect } from 'react';
import { CImage, CButton, CTooltip } from "@coreui/react";
import { FiCopy } from 'react-icons/fi';

// Function to dynamically build the image URL
const buildImageUrl = (id, width, height, keepAspectRatio) => {
  let url = `http://127.0.0.1:8080/public/sprite/${id}`; // Base URL
  const params = new URLSearchParams();

  // Append optional parameters if provided
  if (width) params.append('width', width);
  if (height) params.append('height', height);
  if (typeof keepAspectRatio !== 'undefined') params.append('keepAspectRatio', keepAspectRatio);

  // Add parameters to the URL if any
  if (params.toString()) url += `?${params.toString()}`;

  return url;
};

const RSSprite = ({ id, width, height, keepAspectRatio = true, rounded = false, thumbnail = false, onClick }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true); // Handle loading state
  const [error, setError] = useState(null); // Store error message
  const [retryCount, setRetryCount] = useState(0); // Count retries

  const maxRetries = 3; // Maximum number of retries
  const retryDelay = 2000; // Delay between retries (in milliseconds)

  useEffect(() => {
    const fetchImage = () => {
      if (id && retryCount <= maxRetries) {
        const imageUrl = buildImageUrl(id, width, height, keepAspectRatio);

        // Check if the image is already cached in the browser
        const cachedImage = localStorage.getItem(imageUrl);
        // Fetch the image and store it in cache
        setLoading(true); // Set loading state while fetching
        fetch(imageUrl)
          .then((response) => {
            if (response.ok) {
              return response.blob();
            }
            throw new Error(`Failed to fetch image from ${imageUrl}`);
          })
          .then((blob) => {
            const objectURL = URL.createObjectURL(blob);
            setImageSrc(objectURL);
            localStorage.setItem(imageUrl, objectURL); // Cache the image
            setLoading(false); // Image successfully loaded, stop loading
            setError(null); // Clear any previous errors
          })
          .catch((err) => {
            setError(err.message); // Capture and set the error message
            setLoading(false); // Stop loading on error
            // Retry if retryCount is below maxRetries
            if (retryCount < maxRetries) {
              setTimeout(() => setRetryCount(retryCount + 1), retryDelay);
            }
          });
      }
    };

    fetchImage();
  }, [id, width, height, keepAspectRatio, retryCount]);

  const copyIconUrl = () => {
    const iconUrl = buildImageUrl(id, width, height, keepAspectRatio); // Get dynamic URL
    navigator.clipboard.writeText(iconUrl);
    alert('Icon URL copied to clipboard!');
  };

  if (error && retryCount > maxRetries) {
    // Display the error message only after all retries have failed
    return <div>Error</div>;
  }

  if (loading) {
    return <div>Loading...</div>; // Show loading state while fetching
  }

  // Render the image and copy button
  return (
    <>
      {/* Render the image */}
      <CImage
        src={imageSrc}
        alt={`Sprite ${id}`}
        rounded={rounded} // Conditionally apply rounded prop
        thumbnail={thumbnail} // Conditionally apply thumbnail prop
        onClick={onClick} // Handle click event
        style={{
          width: width ? `${width}px` : 'auto',
          height: height ? `${height}px` : 'auto',
          objectFit: keepAspectRatio ? 'contain' : 'fill',
          cursor: onClick ? 'pointer' : 'default',
        }}
        loading="lazy"
      />
    </>
  );
};

export default RSSprite;
