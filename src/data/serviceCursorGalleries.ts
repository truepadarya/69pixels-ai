import teachly from "@/assets/graphics/second/visuals_teachly-mockup.webp";
import necklace from "@/assets/graphics/second/visuals_teachly-necklace.webp";
import logo from "@/assets/graphics/second/visuals_lvscp.webp";
import girl from "@/assets/graphics/second/visuals_girl.webp";
import guy from "@/assets/graphics/second/visuals_guy.webp";
import portrait from "@/assets/graphics/second/visuals_guy2.webp";
import watch from "@/assets/graphics/second/visuals_clock.webp";
import prototype from "@/assets/graphics/second/dev_1.webp";
import development from "@/assets/graphics/second/dev_3.webp";
import performance from "@/assets/graphics/second/dev_4.webp";
import uiKit from "@/assets/graphics/second/dev_5.webp";
import conceptOne from "@/assets/graphics/second/Concepts_1.webp";
import conceptTwo from "@/assets/graphics/second/Concepts_2.webp";
import conceptThree from "@/assets/graphics/second/Concepts_3.webp";
import conceptFive from "@/assets/graphics/second/Concepts_5.webp";
import healthcare from "@/assets/graphics/cases/healthcare-1-poster.webp";
import nurse from "@/assets/graphics/cases/healthcare-2-poster.webp";
import generatedCode from "@/assets/graphics/cases/healthcare-3-poster.webp";
import android from "@/assets/graphics/cases/android-ui-kit.webp";
import artworkTool from "@/assets/graphics/cases/marketplace-card-tool.png";
import artworkResults from "@/assets/graphics/cases/marketplace-card-before-after.png";
import research from "@/assets/graphics/cases/swapsquad-scenarios-poster.webp";
import personas from "@/assets/graphics/cases/swapsquad-personas-poster.webp";

export const serviceCursorGalleries = {
  brand: [
    teachly,
    logo,
    necklace,
    conceptOne,
    conceptTwo,
    conceptThree,
    conceptFive,
    girl,
  ],
  digital: [
    watch,
    healthcare,
    nurse,
    android,
    uiKit,
    prototype,
    conceptTwo,
    development,
  ],
  creative: [
    girl,
    guy,
    portrait,
    necklace,
    teachly,
    conceptOne,
    conceptThree,
    artworkResults,
  ],
  ai: [
    artworkTool,
    artworkResults,
    generatedCode,
    development,
    research,
    personas,
    performance,
    prototype,
  ],
} satisfies Record<string, ImageMetadata[]>;
