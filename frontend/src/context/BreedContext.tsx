import React, { createContext, useContext, useState } from "react";

interface BreedContextType {
  breedId: string | null;
  breedNameKo: string | null;
  setBreed: (id: string, nameKo: string) => void;
  clearBreed: () => void;
}

const BreedContext = createContext<BreedContextType>({
  breedId: null,
  breedNameKo: null,
  setBreed: () => {},
  clearBreed: () => {},
});

export const BreedProvider = ({ children }: { children: React.ReactNode }) => {
  const [breedId, setBreedId] = useState<string | null>(null);
  const [breedNameKo, setBreedNameKo] = useState<string | null>(null);

  const setBreed = (id: string, nameKo: string) => {
    setBreedId(id);
    setBreedNameKo(nameKo);
  };

  const clearBreed = () => {
    setBreedId(null);
    setBreedNameKo(null);
  };

  return (
    <BreedContext.Provider value={{ breedId, breedNameKo, setBreed, clearBreed }}>
      {children}
    </BreedContext.Provider>
  );
};

export const useBreed = () => useContext(BreedContext);
