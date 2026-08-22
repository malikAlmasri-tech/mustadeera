import { useEffect } from "react";
import {
  Calendar,
  ChevronDown,
  Circle,
  Heart,
  Home,
  LayoutGrid,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  User,
  Volleyball,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { FallbackComponent } from "./CustomComponents";

export default function App() {
  return (
    <div>
      <div className="bg-white text-neutral-950 flex flex-col w-full h-fit h-fit min-h-screen w-screen min-w-screen max-w-screen overflow-visible">
        <div className="flex px-6 pt-6 pb-28 flex-col flex-1 gap-6">
          <div className="flex justify-between items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-neutral-500 text-sm leading-5">
                Good evening,
              </span>
              <span className="font-bold text-2xl leading-8 tracking-tight">
                Khalid Al-Amri
              </span>
              <button className="font-medium text-neutral-900 text-sm leading-5 flex mt-1 items-center gap-1">
                <MapPin className="size-4" />
                Riyadh
                <ChevronDown className="size-3" />
              </button>
            </div>
            <Avatar className="size-12 ring-2 ring-border">
              <AvatarFallback className="font-semibold bg-neutral-900 text-neutral-50">
                KA
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="shadow-sm rounded-xl bg-white border-neutral-200 border-1 border-solid flex px-4 items-center gap-2">
            <Search className="size-5 shrink-0 text-neutral-500" />
            <Input
              placeholder="Search venues by sport or location"
              className="bg-transparent shadow-none border-black/1 border-0 border-solid px-0 h-12"
              defaultValue=""
            />
            <SlidersHorizontal className="size-5 shrink-0 text-neutral-500" />
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-base leading-6">
              Categories
            </span>
            <div className="overflow-x-auto flex -mx-6 px-6 pb-1 gap-3">
              <button className="shrink-0 rounded-2xl border-black/1 border-1 border-solid flex px-4 py-3 flex-col items-center gap-2">
                <LayoutGrid className="size-6" />
                <span className="font-medium text-xs leading-4">All</span>
              </button>
              <button className="shrink-0 rounded-2xl border-black/1 border-1 border-solid flex px-4 py-3 flex-col items-center gap-2">
                <Volleyball className="size-6" />
                <span className="font-medium text-xs leading-4">Football</span>
              </button>
              <button className="shrink-0 rounded-2xl border-black/1 border-1 border-solid flex px-4 py-3 flex-col items-center gap-2">
                <Zap className="size-6" />
                <span className="font-medium text-xs leading-4">Padel</span>
              </button>
              <button className="shrink-0 rounded-2xl border-black/1 border-1 border-solid flex px-4 py-3 flex-col items-center gap-2">
                <FallbackComponent className="size-6" />
                <span className="font-medium text-xs leading-4">
                  Basketball
                </span>
              </button>
              <button className="shrink-0 rounded-2xl border-black/1 border-1 border-solid flex px-4 py-3 flex-col items-center gap-2">
                <Circle className="size-6" />
                <span className="font-medium text-xs leading-4">Tennis</span>
              </button>
              <button className="shrink-0 rounded-2xl border-black/1 border-1 border-solid flex px-4 py-3 flex-col items-center gap-2">
                <Volleyball className="size-6" />
                <span className="font-medium text-xs leading-4">
                  Volleyball
                </span>
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-base leading-6">
                Nearby Venues
              </span>
              <button className="font-medium text-neutral-900 text-sm leading-5">
                See all
              </button>
            </div>
            <Card className="shadow-md rounded-2xl border-neutral-200 border-0 border-solid p-0 gap-0 overflow-hidden">
              <div className="relative w-full h-40">
                <img
                  src="https://images.unsplash.com/photo-1658491830143-72808ca237e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHxwYWRlbCUyMGNvdXJ0JTIwc3BvcnQlMjBpbmRvb3J8ZW58MXwwfHx8MTc4NDgwMTc4MHww&ixlib=rb-4.1.0&q=80&w=400"
                  alt="Padel court"
                  className="object-cover w-full h-full"
                  data-photoid="3sSbRisCnmE"
                  data-authorname="Oskar Hagberg"
                  data-authorurl="https://unsplash.com/@knosk"
                  data-blurhash="LdD,g2x{ITt8~Ls%M{t6s;RkRioI"
                />
                <button className="size-9 shadow-sm rounded-full bg-white/90 flex absolute right-3 top-3 justify-center items-center">
                  <Heart />
                </button>
                <Badge className="shadow-sm bg-white/90 text-neutral-950 absolute left-3 top-3">
                  Padel
                </Badge>
              </div>
              <CardContent className="flex p-4 flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">Ledap Padel Arena</span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        1.2 km
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-chart4 text-[#ffb900]" />
                        4.8
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-lg leading-7">SAR 90</span>
                    <span className="text-neutral-500 text-xs leading-4">
                      / hour
                    </span>
                  </div>
                </div>
                <Button className="rounded-xl bg-neutral-900 text-neutral-50 w-full">
                  Book Now
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-md rounded-2xl border-neutral-200 border-0 border-solid p-0 gap-0 overflow-hidden">
              <div className="relative w-full h-40">
                <img
                  src="https://images.unsplash.com/photo-1610729866389-fbf90649c302?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMHBpdGNoJTIwdHVyZiUyMGZpZWxkfGVufDF8MHx8fDE3ODQ4MDE3ODB8MA&ixlib=rb-4.1.0&q=80&w=400"
                  alt="Football pitch"
                  className="object-cover w-full h-full"
                  data-photoid="fDmpxdV69eA"
                  data-authorname="Thomas Park"
                  data-authorurl="https://unsplash.com/@thomascpark"
                  data-blurhash="LdDn8?4ms=aex[ofMx%NM_xvM{t7"
                />
                <button className="size-9 shadow-sm rounded-full bg-white/90 flex absolute right-3 top-3 justify-center items-center">
                  <Heart />
                </button>
                <Badge className="shadow-sm bg-white/90 text-neutral-950 absolute left-3 top-3">
                  Football
                </Badge>
              </div>
              <CardContent className="flex p-4 flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">Green Field Complex</span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        2.6 km
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-chart4 text-[#ffb900]" />
                        4.6
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-lg leading-7">SAR 150</span>
                    <span className="text-neutral-500 text-xs leading-4">
                      / hour
                    </span>
                  </div>
                </div>
                <Button className="rounded-xl bg-neutral-900 text-neutral-50 w-full">
                  Book Now
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-md rounded-2xl border-neutral-200 border-0 border-solid p-0 gap-0 overflow-hidden">
              <div className="relative w-full h-40">
                <img
                  src="https://images.unsplash.com/photo-1559369064-c4d65141e408?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHxiYXNrZXRiYWxsJTIwY291cnQlMjBpbmRvb3IlMjBneW18ZW58MXwwfHx8MTc4NDgwMTc4MHww&ixlib=rb-4.1.0&q=80&w=400"
                  alt="Basketball court"
                  className="object-cover w-full h-full"
                  data-photoid="hEQpoeUuJXA"
                  data-authorname="Patrick Schöpflin"
                  data-authorurl="https://unsplash.com/@patrickschoepflin"
                  data-blurhash="LC8qB7oL0KWBxHj[E1WB?bj[E0WB"
                />
                <button className="size-9 shadow-sm rounded-full bg-white/90 flex absolute right-3 top-3 justify-center items-center">
                  <Heart />
                </button>
                <Badge className="shadow-sm bg-white/90 text-neutral-950 absolute left-3 top-3">
                  Basketball
                </Badge>
              </div>
              <CardContent className="flex p-4 flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">Downtown Hoops Center</span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        3.1 km
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-chart4 text-[#ffb900]" />
                        4.9
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-lg leading-7">SAR 110</span>
                    <span className="text-neutral-500 text-xs leading-4">
                      / hour
                    </span>
                  </div>
                </div>
                <Button className="rounded-xl bg-neutral-900 text-neutral-50 w-full">
                  Book Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="fixed bg-white border-neutral-200 border-t-1 border-r-0 border-b-0 border-l-0 border-solid flex inset-x-0 bottom-0 px-4 py-3 justify-around items-center">
          <button className="text-neutral-900 flex flex-col items-center gap-1">
            <Home className="size-6" />
            <span className="font-medium text-xs leading-4">Home</span>
          </button>
          <button className="text-neutral-500 flex flex-col items-center gap-1">
            <Search className="size-6" />
            <span className="font-medium text-xs leading-4">Browse</span>
          </button>
          <button className="text-neutral-500 flex flex-col items-center gap-1">
            <Calendar className="size-6" />
            <span className="font-medium text-xs leading-4">Bookings</span>
          </button>
          <button className="text-neutral-500 flex flex-col items-center gap-1">
            <User className="size-6" />
            <span className="font-medium text-xs leading-4">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
