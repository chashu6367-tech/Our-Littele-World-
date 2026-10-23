import { BookHeart, BookOpen, Camera, Compass, Gift, Home, Mail, MapPin, Music, Settings, Sparkles, Users, type LucideIcon } from "lucide-react";
export interface NavItem { slug: string; label: string; icon: LucideIcon; blurb: string }
export const NAV: NavItem[] = [
  { slug: "home", label: "Home", icon: Home, blurb: "Your shared home." },
  { slug: "story", label: "Our Story", icon: BookHeart, blurb: "The chapters of your life together, told in order." },
  { slug: "memories", label: "Memories", icon: Camera, blurb: "Moments worth keeping, with the photos that go with them." },
  { slug: "letters", label: "Letters", icon: Mail, blurb: "Words written slowly, for each other." },
  { slug: "surprises", label: "Surprises", icon: Gift, blurb: "Little things waiting to be unlocked." },
  { slug: "dreams", label: "Dreams", icon: Sparkles, blurb: "Everything you hope to build and become together." },
  { slug: "places", label: "Places", icon: MapPin, blurb: "Where you've been and where you'll go next." },
  { slug: "music", label: "Music", icon: Music, blurb: "The songs that sound like you two." },
  { slug: "journal", label: "Journal", icon: BookOpen, blurb: "Your own thoughts, shared or kept private." },
  { slug: "us", label: "Us", icon: Users, blurb: "The two of you, at a glance." },
  { slug: "settings", label: "Settings", icon: Settings, blurb: "Make the world yours." },
];
export const CREATE_OPTIONS = [
  { label: "Memory", icon: Camera, blurb: "Keep a moment, with photos" },
  { label: "Letter", icon: Mail, blurb: "Write something slowly" },
  { label: "Surprise", icon: Gift, blurb: "Hide a little something" },
  { label: "Dream", icon: Sparkles, blurb: "Something you hope for" },
  { label: "Place", icon: MapPin, blurb: "Somewhere that matters" },
  { label: "Journal", icon: BookOpen, blurb: "Your own thoughts" },
  { label: "Milestone", icon: Compass, blurb: "A day worth marking" },
  { label: "Song", icon: Music, blurb: "Something that sounds like us" },
];
