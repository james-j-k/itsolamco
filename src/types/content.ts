export type QuizRoundDTO = {
  id: string;
  order: number;
  title: string;
  description: string;
};

export type VenueDTO = {
  id: string;
  order: number;
  name: string;
  area: string | null;
};
