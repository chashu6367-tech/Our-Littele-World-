"use client";
import { createContext, useContext } from "react";
/** Lets any page open the shell's existing "Add to our world" sheet. */
export const CreateContext = createContext<() => void>(() => {});
export const useOpenCreate = () => useContext(CreateContext);
/** Opens the new-memory form directly (same sheet system). */
export const MemoryCreateContext = createContext<() => void>(() => {});
export const useOpenMemoryCreate = () => useContext(MemoryCreateContext);
/** Opens the new-dream form directly (same sheet system). */
export const DreamCreateContext = createContext<() => void>(() => {});
export const useOpenDreamCreate = () => useContext(DreamCreateContext);
/** Opens the new-place form directly (same sheet system). */
export const PlaceCreateContext = createContext<() => void>(() => {});
export const useOpenPlaceCreate = () => useContext(PlaceCreateContext);
/** Opens the new-song form directly (same sheet system). */
export const SongCreateContext = createContext<() => void>(() => {});
export const useOpenSongCreate = () => useContext(SongCreateContext);
/** Opens the new-letter form directly (same sheet system). */
export const LetterCreateContext = createContext<() => void>(() => {});
export const useOpenLetterCreate = () => useContext(LetterCreateContext);
