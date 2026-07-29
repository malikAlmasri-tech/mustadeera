import { useEffect } from "react";
import {
  CalendarCheck,
  Circle,
  Clock,
  Plus,
  Volleyball,
  Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function App() {
  return (
    <div>
      <div className="bg-white text-neutral-950 w-full h-fit h-fit min-h-screen w-screen min-w-screen max-w-screen overflow-visible">
        <div className="min-h-[874px] max-w-[402px] relative flex mx-auto flex-col w-full">
          <div className="flex px-6 pt-6 pb-32 flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <h1 className="font-bold text-2xl leading-8 tracking-tight">
                  Dashboard
                </h1>
                <p className="text-neutral-500 text-sm leading-5">
                  Al-Ittihad Sports Complex
                </p>
              </div>
              <Avatar className="size-11 border-neutral-200 border-1 border-solid">
                <AvatarFallback className="font-semibold bg-neutral-900 text-neutral-50">
                  AI
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="overflow-x-auto flex -mx-6 px-6 gap-3">
              <Card className="min-w-[130px] shrink-0 p-4 gap-3">
                <CardHeader className="p-0 gap-0">
                  <div className="size-9 rounded-lg bg-neutral-900 text-neutral-50 flex justify-center items-center">
                    <CalendarCheck className="size-4" />
                  </div>
                </CardHeader>
                <CardContent className="flex p-0 flex-col gap-1">
                  <span className="leading-none font-bold text-2xl leading-8">
                    12
                  </span>
                  <span className="text-neutral-500 text-xs leading-4">
                    Today's Bookings
                  </span>
                </CardContent>
              </Card>
              <Card className="min-w-[130px] shrink-0 p-4 gap-3">
                <CardHeader className="p-0 gap-0">
                  <div className="size-9 rounded-lg bg-neutral-900 text-neutral-50 flex justify-center items-center">
                    <Wallet className="size-4" />
                  </div>
                </CardHeader>
                <CardContent className="flex p-0 flex-col gap-1">
                  <span className="leading-none font-bold text-2xl leading-8">
                    $1,840
                  </span>
                  <span className="text-neutral-500 text-xs leading-4">
                    Total Revenue
                  </span>
                </CardContent>
              </Card>
              <Card className="min-w-[130px] shrink-0 p-4 gap-3">
                <CardHeader className="p-0 gap-0">
                  <div className="size-9 rounded-lg bg-neutral-900 text-neutral-50 flex justify-center items-center">
                    <Clock className="size-4" />
                  </div>
                </CardHeader>
                <CardContent className="flex p-0 flex-col gap-1">
                  <span className="leading-none font-bold text-2xl leading-8">
                    8
                  </span>
                  <span className="text-neutral-500 text-xs leading-4">
                    Upcoming Reservations
                  </span>
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-lg leading-7">
                  Manage Venues
                </h2>
                <button className="font-medium text-neutral-900 text-sm leading-5">
                  See all
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <Card className="p-3 flex-row items-center gap-0">
                  <div className="size-16 shrink-0 rounded-xl overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1668068872884-c1dff139285d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHxzb2NjZXIlMjBmaWVsZCUyMGdyZWVuJTIwZ3Jhc3N8ZW58MXwyfHx8MTc4NDgwMTc4Nnww&ixlib=rb-4.1.0&q=80&w=400"
                      alt="Football pitch"
                      className="object-cover w-full h-full"
                      data-photoid="d7AXvFUjqxA"
                      data-authorname="Amir Lehri"
                      data-authorurl="https://unsplash.com/@amirlehri"
                      data-blurhash="LJDm8EImxmai~qM_W9j]t8V[RQfk"
                    />
                  </div>
                  <div className="flex px-3 flex-col flex-1 gap-1">
                    <span className="leading-tight font-semibold text-sm leading-5">
                      Green Pitch Arena
                    </span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-1">
                      <Volleyball className="size-3.5" />
                      <span>Football</span>
                    </div>
                    <span />
                  </div>
                  <Switch defaultChecked={true} />
                </Card>
                <Card className="p-3 flex-row items-center gap-0">
                  <div className="size-16 shrink-0 rounded-xl overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1685880423505-3a9a5515efd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBjb3VydCUyMG5ldHxlbnwxfDJ8fHwxNzg0ODAxNzg2fDA&ixlib=rb-4.1.0&q=80&w=400"
                      alt="Tennis court"
                      className="object-cover w-full h-full"
                      data-photoid="StYnQsSRUPY"
                      data-authorname="Siddharth Patel"
                      data-authorurl="https://unsplash.com/@widowswail22"
                      data-blurhash="LvJbv3NFoyj]swk7j]jcbgjGayj["
                    />
                  </div>
                  <div className="flex px-3 flex-col flex-1 gap-1">
                    <span className="leading-tight font-semibold text-sm leading-5">
                      Baseline Tennis Club
                    </span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-1">
                      <Circle className="size-3.5" />
                      <span>Tennis</span>
                    </div>
                    <span />
                  </div>
                  <Switch defaultChecked={true} />
                </Card>
                <Card className="p-3 flex-row items-center gap-0">
                  <div className="size-16 shrink-0 rounded-xl overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1657709288025-06d5eaa41757?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHxwYWRlbCUyMGNvdXJ0fGVufDF8Mnx8fDE3ODQ4MDE3ODZ8MA&ixlib=rb-4.1.0&q=80&w=400"
                      alt="Padel court"
                      className="object-cover w-full h-full"
                      data-photoid="pm7GSTVrndc"
                      data-authorname="Oskar Hagberg"
                      data-authorurl="https://unsplash.com/@knosk"
                      data-blurhash="LRFZ8JR*9ct7,~ax?FRkxwWBD*oe"
                    />
                  </div>
                  <div className="flex px-3 flex-col flex-1 gap-1">
                    <span className="leading-tight font-semibold text-sm leading-5">
                      Smash Padel Center
                    </span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-1">
                      <Circle className="size-3.5" />
                      <span>Padel</span>
                    </div>
                    <span />
                  </div>
                  <Switch defaultChecked={false} />
                </Card>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-lg leading-7">
                  Recent Bookings
                </h2>
                <button className="font-medium text-neutral-900 text-sm leading-5">
                  See all
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <Card className="p-4 flex-row items-center gap-0">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="font-semibold bg-neutral-100 text-neutral-900 text-xs leading-4">
                      OK
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex px-3 flex-col flex-1 gap-1">
                    <span className="leading-tight font-semibold text-sm leading-5">
                      Omar Khalid
                    </span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-2">
                      <span>Football</span>
                      <span className="size-1 rounded-full bg-neutral-500" />
                      <span>6:00 - 7:00 PM</span>
                    </div>
                  </div>
                  <Badge className="border-transparent rounded-full bg-neutral-900 text-neutral-50">
                    Confirmed
                  </Badge>
                </Card>
                <Card className="p-4 flex-row items-center gap-0">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="font-semibold bg-neutral-100 text-neutral-900 text-xs leading-4">
                      SN
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex px-3 flex-col flex-1 gap-1">
                    <span className="leading-tight font-semibold text-sm leading-5">
                      Sara Nasser
                    </span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-2">
                      <span>Tennis</span>
                      <span className="size-1 rounded-full bg-neutral-500" />
                      <span>4:30 - 5:30 PM</span>
                    </div>
                  </div>
                  <Badge className="border-transparent rounded-full bg-amber-100 text-amber-700">
                    Pending
                  </Badge>
                </Card>
                <Card className="p-4 flex-row items-center gap-0">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="font-semibold bg-neutral-100 text-neutral-900 text-xs leading-4">
                      YH
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex px-3 flex-col flex-1 gap-1">
                    <span className="leading-tight font-semibold text-sm leading-5">
                      Yousef Hamad
                    </span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-2">
                      <span>Padel</span>
                      <span className="size-1 rounded-full bg-neutral-500" />
                      <span>8:00 - 9:00 PM</span>
                    </div>
                  </div>
                  <Badge className="border-transparent rounded-full bg-[#e7000b]/10 text-[#e7000b]">
                    Cancelled
                  </Badge>
                </Card>
                <Card className="p-4 flex-row items-center gap-0">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="font-semibold bg-neutral-100 text-neutral-900 text-xs leading-4">
                      LA
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex px-3 flex-col flex-1 gap-1">
                    <span className="leading-tight font-semibold text-sm leading-5">
                      Layla Ahmed
                    </span>
                    <div className="text-neutral-500 text-xs leading-4 flex items-center gap-2">
                      <span>Football</span>
                      <span className="size-1 rounded-full bg-neutral-500" />
                      <span>7:00 - 8:00 PM</span>
                    </div>
                  </div>
                  <Badge className="border-transparent rounded-full bg-neutral-900 text-neutral-50">
                    Confirmed
                  </Badge>
                </Card>
              </div>
            </div>
          </div>
          <Button className="shadow-lg rounded-full absolute right-6 bottom-6 px-5 gap-2 h-14">
            <Plus className="size-5" />
            <span className="font-semibold">Add New Venue</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
