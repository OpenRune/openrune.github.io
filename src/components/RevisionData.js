import React, { useEffect, useState } from 'react';
import useRevisionService from "src/api/revisionService";

const RevisionData = ({ gameType, dataMethod, render }) => {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const revisionService = useRevisionService();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await dataMethod(revisionService, gameType);
        setData(result);
      } catch (err) {
        setError(err);
      }
    };

    fetchData();
  }, [gameType, dataMethod, revisionService]);

  return render({ data, error });
};

export default RevisionData;
