import React, { useState, useEffect } from 'react';
import { Puff } from "react-loader-spinner";

function ImageComponent({ imageName, itemName, imgWidth, imgHeight, imgMargin }) {
    const [imageSrc, setImageSrc] = useState(null);

    useEffect(() => {
        const img = new Image();

        // Define local and remote paths
        const localPath = `/item-icons/${itemName}.png`;
        const remotePath = `https://oldschool.runescape.wiki/images/thumb/${imageName}_detail.png/120px-${imageName}_detail.png`;

        // Set handlers for load and error events
        img.onload = () => setImageSrc(localPath);
        img.onerror = () => setImageSrc(remotePath);

        // Start loading the image
        img.src = localPath;
    }, [imageName, itemName]); // Re-run this effect if imageName or itemName changes

    // Render the image or a placeholder/loading text
    return (
        <div>
            {imageSrc ? <img src={imageSrc} alt={itemName} style={{ width: imgWidth, height: imgHeight, marginRight: imgMargin }} /> : <div style={{ width: "24px", height: "24px", marginRight: "4px" }}></div>}
        </div>
    );
}

export { ImageComponent };