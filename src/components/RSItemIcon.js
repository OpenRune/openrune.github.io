import React, { useState, useEffect } from 'react';
import { CImage } from "@coreui/react";

// Function to dynamically build the image URL
export const buildImageUrl = (id, params = {}) => {
  let url = `https://osrs.openrune.dev/public/item/${id}/icon`; // Base URL
  const queryParams = new URLSearchParams();

  // Append optional parameters only if they are provided
  if (params.quantity) queryParams.append('quantity', params.quantity);
  if (params.width) queryParams.append('width', params.width);
  if (params.height) queryParams.append('height', params.height);
  if (params.border) queryParams.append('border', params.border);
  if (params.shadowColor) queryParams.append('shadowColor', params.shadowColor);
  if (params.isNoted) queryParams.append('isNoted', params.isNoted);
  if (params.xan2d) queryParams.append('xan2d', params.xan2d);
  if (params.yan2d) queryParams.append('yan2d', params.yan2d);
  if (params.zoom2d) queryParams.append('zoom2d', params.zoom2d);
  if (params.zan2d) queryParams.append('zan2d', params.zan2d);
  if (params.xOffset2d) queryParams.append('xOffset2d', params.xOffset2d);
  if (params.yOffset2d) queryParams.append('yOffset2d', params.yOffset2d);

  // If there are query parameters, append them to the URL
  if (queryParams.toString()) {
    url += `?${queryParams.toString()}`;
  }

  return url;
};

const RSItemIcon = ({ id, params = {}}) => {

  // Render the image only when fully loaded
  return (
    <img
      src={buildImageUrl(id,params)}
      alt={`Item ${id}`}
      style={{objectFit: 'contain'}}
    />
  );
};

export default RSItemIcon;
