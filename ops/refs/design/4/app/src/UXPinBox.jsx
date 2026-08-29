import React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import { Image } from 'mui-image';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';


export default function UXPinBox() {



  return (<Box
  width="100%"
  sx={{ display: "flex", gap: "24px", backgroundColor: "#F3F4F6", padding: "24px", fontFamily: "Inter, sans-serif" }}
>
  <style
  >
    {`
      .almus-slot { transition: all 0.15s ease; cursor: pointer; }
      .almus-slot:hover { transform: translateY(-2px); }
      .almus-venue-card:hover { box-shadow: 0 12px 24px rgba(0,0,0,0.12); }
    `}
  </style>
  <Box
    sx={{ width: "380px", height: "812px", backgroundColor: "#0B0F19", borderRadius: "40px", padding: "10px", boxShadow: "0 20px 50px rgba(0,0,0,0.35)", flexShrink: 0 }}
  >
    <Box
      sx={{ width: "100%", height: "100%", backgroundColor: "#F7F8FA", borderRadius: "32px", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}
    >
      <Box
        sx={{ padding: "16px 20px 8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography
          sx={{ fontSize: "13px", fontWeight: 700, color: "#0B0F19" }}
        >
          9:41
        </Typography>
        <Box
          sx={{ display: "flex", gap: "6px" }}
        >
          <Icon
            sx={{ fontSize: "16px" }}
          >
            <img
              style={{ width: 16, height: 16 }}
              src="https://api.iconify.design/mdi/signal-cellular-3.svg?color=%230B0F19"
            />
          </Icon>
          <Icon
            sx={{ fontSize: "16px" }}
          >
            <img
              style={{ width: 16, height: 16 }}
              src="https://api.iconify.design/mdi/wifi.svg?color=%230B0F19"
            />
          </Icon>
          <Icon
            sx={{ fontSize: "16px" }}
          >
            <img
              style={{ width: 16, height: 16 }}
              src="https://api.iconify.design/mdi/battery.svg?color=%230B0F19"
            />
          </Icon>
        </Box>
      </Box>
      <Box
        sx={{ padding: "4px 20px 12px 20px" }}
      >
        <Stack
          direction="row"
          spacing="8px"
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box>
            <Typography
              sx={{ fontSize: "12px", color: "#8A93A3", fontWeight: 500 }}
            >
              Booking in
            </Typography>
            <Stack
              direction="row"
              spacing="4px"
              sx={{ alignItems: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 16, height: 16 }}
                  src="https://api.iconify.design/mdi/map-marker.svg?color=%23FF6A3D"
                />
              </Icon>
              <Typography
                sx={{ fontSize: "15px", fontWeight: 700, color: "#0B0F19" }}
              >
                Riyadh, Al Olaya
              </Typography>
              <Icon>
                <img
                  style={{ width: 14, height: 14 }}
                  src="https://api.iconify.design/mdi/chevron-down.svg?color=%230B0F19"
                />
              </Icon>
            </Stack>
          </Box>
          <Avatar
            sx={{ width: 36, height: 36, backgroundColor: "#FF6A3D", fontSize: "14px", fontWeight: 700 }}
          >
            KZ
          </Avatar>
        </Stack>
        <Box
          sx={{ marginTop: "14px", backgroundColor: "#FFFFFF", borderRadius: "14px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <Icon>
            <img
              style={{ width: 20, height: 20 }}
              src="https://api.iconify.design/mdi/magnify.svg?color=%238A93A3"
            />
          </Icon>
          <Typography
            sx={{ fontSize: "14px", color: "#A6ADB8" }}
          >
            Search courts, venues...
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{ padding: "0 20px 10px 20px" }}
      >
        <Stack
          direction="row"
          spacing="8px"
          sx={{ overflowX: "auto" }}
        >
          <Chip
            label="⚽ Football"
            sx={{ backgroundColor: "#0B0F19", color: "#FFFFFF", fontWeight: 700, fontSize: "12px", height: "32px" }}
          />
          <Chip
            label="🎾 Padel"
            sx={{ backgroundColor: "#FFFFFF", color: "#0B0F19", fontWeight: 600, fontSize: "12px", height: "32px", border: "1px solid #E5E7EB" }}
          />
          <Chip
            label="🏀 Basketball"
            sx={{ backgroundColor: "#FFFFFF", color: "#0B0F19", fontWeight: 600, fontSize: "12px", height: "32px", border: "1px solid #E5E7EB" }}
          />
          <Chip
            label="🏸 Padel"
            sx={{ backgroundColor: "#FFFFFF", color: "#0B0F19", fontWeight: 600, fontSize: "12px", height: "32px", border: "1px solid #E5E7EB" }}
          />
        </Stack>
      </Box>
      <Box
        sx={{ padding: "0 20px 12px 20px" }}
      >
        <Stack
          direction="row"
          spacing="8px"
        >
          <Box
            sx={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E5E7EB" }}
          >
            <Icon>
              <img
                style={{ width: 16, height: 16 }}
                src="https://api.iconify.design/mdi/calendar-blank.svg?color=%230B0F19"
              />
            </Icon>
            <Typography
              sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
            >
              Today, Jul 23
            </Typography>
          </Box>
          <Box
            sx={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E5E7EB" }}
          >
            <Icon>
              <img
                style={{ width: 16, height: 16 }}
                src="https://api.iconify.design/mdi/clock-outline.svg?color=%230B0F19"
              />
            </Icon>
            <Typography
              sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
            >
              7:00 PM
            </Typography>
          </Box>
          <Box
            sx={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #E5E7EB" }}
          >
            <Icon>
              <img
                style={{ width: 16, height: 16 }}
                src="https://api.iconify.design/mdi/map-marker-radius.svg?color=%230B0F19"
              />
            </Icon>
            <Typography
              sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
            >
              5 km
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Box
        sx={{ flex: 1, overflowY: "auto", padding: "0 20px 90px 20px" }}
      >
        <Stack
          direction="row"
          spacing="8px"
          sx={{ alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}
        >
          <Typography
            sx={{ fontSize: "14px", fontWeight: 700, color: "#0B0F19" }}
          >
            12 venues near you
          </Typography>
          <Stack
            direction="row"
            spacing="4px"
            sx={{ alignItems: "center" }}
          >
            <Icon>
              <img
                style={{ width: 16, height: 16 }}
                src="https://api.iconify.design/mdi/sort-variant.svg?color=%23FF6A3D"
              />
            </Icon>
            <Typography
              sx={{ fontSize: "12px", fontWeight: 600, color: "#FF6A3D" }}
            >
              Sort
            </Typography>
          </Stack>
        </Stack>
        <Card
          className="almus-venue-card"
          sx={{ borderRadius: "18px", overflow: "hidden", marginBottom: "14px", boxShadow: "0 4px 14px rgba(0,0,0,0.08)", border: "none" }}
        >
          <Box
            sx={{ position: "relative" }}
          >
            <Image
              src="https://uc.uxpin.com/ai-chat/d279ab32ec221f17/images/1784822486100-c1366b0d61322210.png"
              fit="cover"
              width="100%"
              height="140px"
            />
            <Chip
              label="8 slots open"
              sx={{ position: "absolute", top: "10px", left: "10px", backgroundColor: "#16A34A", color: "#FFFFFF", fontWeight: 700, fontSize: "11px", height: "24px" }}
            />
            <Box
              sx={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "rgba(11,15,25,0.6)", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 16, height: 16 }}
                  src="https://api.iconify.design/mdi/heart-outline.svg?color=%23FFFFFF"
                />
              </Icon>
            </Box>
          </Box>
          <CardContent
            sx={{ padding: "12px 14px" }}
          >
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: "14px", fontWeight: 700, color: "#0B0F19" }}
                >
                  Al Nakheel Futsal Arena
                </Typography>
                <Stack
                  direction="row"
                  spacing="4px"
                  sx={{ alignItems: "center", marginTop: "2px" }}
                >
                  <Icon>
                    <img
                      style={{ width: 13, height: 13 }}
                      src="https://api.iconify.design/mdi/map-marker.svg?color=%238A93A3"
                    />
                  </Icon>
                  <Typography
                    sx={{ fontSize: "11px", color: "#8A93A3" }}
                  >
                    2.4 km · Al Olaya
                  </Typography>
                </Stack>
              </Box>
              <Stack
                direction="row"
                spacing="2px"
                sx={{ alignItems: "center" }}
              >
                <Icon>
                  <img
                    style={{ width: 14, height: 14 }}
                    src="https://api.iconify.design/mdi/star.svg?color=%23F59E0B"
                  />
                </Icon>
                <Typography
                  sx={{ fontSize: "12px", fontWeight: 700, color: "#0B0F19" }}
                >
                  4.8
                </Typography>
              </Stack>
            </Stack>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}
            >
              <Typography
                sx={{ fontSize: "15px", fontWeight: 800, color: "#FF6A3D" }}
              >
                <span
                >
                  SAR 120 
                </span>
                <Typography
                  component="span"
                  sx={{ fontSize: "11px", fontWeight: 500, color: "#8A93A3" }}
                >
                  /hr
                </Typography>
              </Typography>
              <Chip
                label="Football · 5v5"
                sx={{ backgroundColor: "#F3F4F6", color: "#0B0F19", fontSize: "10px", height: "22px", fontWeight: 600 }}
              />
            </Stack>
          </CardContent>
        </Card>
        <Card
          className="almus-venue-card"
          sx={{ borderRadius: "18px", overflow: "hidden", marginBottom: "14px", boxShadow: "0 4px 14px rgba(0,0,0,0.08)", border: "none" }}
        >
          <Box
            sx={{ position: "relative" }}
          >
            <Image
              src="https://uc.uxpin.com/ai-chat/d279ab32ec221f17/images/1784822491876-a6f0c7e246811d09.png"
              fit="cover"
              width="100%"
              height="140px"
            />
            <Chip
              label="3 slots open"
              sx={{ position: "absolute", top: "10px", left: "10px", backgroundColor: "#F59E0B", color: "#FFFFFF", fontWeight: 700, fontSize: "11px", height: "24px" }}
            />
            <Box
              sx={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "rgba(11,15,25,0.6)", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 16, height: 16 }}
                  src="https://api.iconify.design/mdi/heart.svg?color=%23FF6A3D"
                />
              </Icon>
            </Box>
          </Box>
          <CardContent
            sx={{ padding: "12px 14px" }}
          >
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: "14px", fontWeight: 700, color: "#0B0F19" }}
                >
                  Elite Padel Club
                </Typography>
                <Stack
                  direction="row"
                  spacing="4px"
                  sx={{ alignItems: "center", marginTop: "2px" }}
                >
                  <Icon>
                    <img
                      style={{ width: 13, height: 13 }}
                      src="https://api.iconify.design/mdi/map-marker.svg?color=%238A93A3"
                    />
                  </Icon>
                  <Typography
                    sx={{ fontSize: "11px", color: "#8A93A3" }}
                  >
                    3.1 km · King Fahd Rd
                  </Typography>
                </Stack>
              </Box>
              <Stack
                direction="row"
                spacing="2px"
                sx={{ alignItems: "center" }}
              >
                <Icon>
                  <img
                    style={{ width: 14, height: 14 }}
                    src="https://api.iconify.design/mdi/star.svg?color=%23F59E0B"
                  />
                </Icon>
                <Typography
                  sx={{ fontSize: "12px", fontWeight: 700, color: "#0B0F19" }}
                >
                  4.6
                </Typography>
              </Stack>
            </Stack>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}
            >
              <Typography
                sx={{ fontSize: "15px", fontWeight: 800, color: "#FF6A3D" }}
              >
                <span
                >
                  SAR 90 
                </span>
                <Typography
                  component="span"
                  sx={{ fontSize: "11px", fontWeight: 500, color: "#8A93A3" }}
                >
                  /hr
                </Typography>
              </Typography>
              <Chip
                label="Padel · Indoor"
                sx={{ backgroundColor: "#F3F4F6", color: "#0B0F19", fontSize: "10px", height: "22px", fontWeight: 600 }}
              />
            </Stack>
          </CardContent>
        </Card>
      </Box>
      <Box
        sx={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFF", borderTop: "1px solid #EEF0F3", padding: "10px 24px 20px 24px", display: "flex", justifyContent: "space-between" }}
      >
        <Stack
          sx={{ alignItems: "center" }}
          spacing="2px"
        >
          <Icon>
            <img
              style={{ width: 22, height: 22 }}
              src="https://api.iconify.design/mdi/magnify.svg?color=%23FF6A3D"
            />
          </Icon>
          <Typography
            sx={{ fontSize: "10px", fontWeight: 700, color: "#FF6A3D" }}
          >
            Search
          </Typography>
        </Stack>
        <Stack
          sx={{ alignItems: "center" }}
          spacing="2px"
        >
          <Icon>
            <img
              style={{ width: 22, height: 22 }}
              src="https://api.iconify.design/mdi/calendar-check-outline.svg?color=%23A6ADB8"
            />
          </Icon>
          <Typography
            sx={{ fontSize: "10px", fontWeight: 600, color: "#A6ADB8" }}
          >
            Bookings
          </Typography>
        </Stack>
        <Stack
          sx={{ alignItems: "center" }}
          spacing="2px"
        >
          <Icon>
            <img
              style={{ width: 22, height: 22 }}
              src="https://api.iconify.design/mdi/message-text-outline.svg?color=%23A6ADB8"
            />
          </Icon>
          <Typography
            sx={{ fontSize: "10px", fontWeight: 600, color: "#A6ADB8" }}
          >
            Messages
          </Typography>
        </Stack>
        <Stack
          sx={{ alignItems: "center" }}
          spacing="2px"
        >
          <Icon>
            <img
              style={{ width: 22, height: 22 }}
              src="https://api.iconify.design/mdi/account-outline.svg?color=%23A6ADB8"
            />
          </Icon>
          <Typography
            sx={{ fontSize: "10px", fontWeight: 600, color: "#A6ADB8" }}
          >
            Profile
          </Typography>
        </Stack>
      </Box>
    </Box>
  </Box>
  <Box
    sx={{ width: "380px", height: "812px", backgroundColor: "#0B0F19", borderRadius: "40px", padding: "10px", boxShadow: "0 20px 50px rgba(0,0,0,0.35)", flexShrink: 0 }}
  >
    <Box
      sx={{ width: "100%", height: "100%", backgroundColor: "#F7F8FA", borderRadius: "32px", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}
    >
      <Box
        sx={{ position: "relative" }}
      >
        <Image
          src="https://uc.uxpin.com/ai-chat/d279ab32ec221f17/images/1784822486100-c1366b0d61322210.png"
          fit="cover"
          width="100%"
          height="220px"
        />
        <Box
          sx={{ position: "absolute", top: "16px", left: "16px", right: "16px", display: "flex", justifyContent: "space-between" }}
        >
          <Box
            sx={{ backgroundColor: "rgba(11,15,25,0.55)", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Icon>
              <img
                style={{ width: 18, height: 18 }}
                src="https://api.iconify.design/mdi/arrow-left.svg?color=%23FFFFFF"
              />
            </Icon>
          </Box>
          <Stack
            direction="row"
            spacing="8px"
          >
            <Box
              sx={{ backgroundColor: "rgba(11,15,25,0.55)", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 16, height: 16 }}
                  src="https://api.iconify.design/mdi/share-variant-outline.svg?color=%23FFFFFF"
                />
              </Icon>
            </Box>
            <Box
              sx={{ backgroundColor: "rgba(11,15,25,0.55)", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 16, height: 16 }}
                  src="https://api.iconify.design/mdi/heart-outline.svg?color=%23FFFFFF"
                />
              </Icon>
            </Box>
          </Stack>
        </Box>
        <Stack
          direction="row"
          spacing="6px"
          sx={{ position: "absolute", bottom: "12px", left: "16px" }}
        >
          <Box
            sx={{ width: "18px", height: "4px", borderRadius: "2px", backgroundColor: "#FFFFFF" }}
          />
          <Box
            sx={{ width: "18px", height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.4)" }}
          />
          <Box
            sx={{ width: "18px", height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.4)" }}
          />
        </Stack>
      </Box>
      <Box
        sx={{ flex: 1, overflowY: "auto", padding: "16px 20px 90px 20px" }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <Box>
            <Typography
              sx={{ fontSize: "18px", fontWeight: 800, color: "#0B0F19" }}
            >
              Al Nakheel Futsal Arena
            </Typography>
            <Stack
              direction="row"
              spacing="4px"
              sx={{ alignItems: "center", marginTop: "4px" }}
            >
              <Icon>
                <img
                  style={{ width: 14, height: 14 }}
                  src="https://api.iconify.design/mdi/map-marker.svg?color=%238A93A3"
                />
              </Icon>
              <Typography
                sx={{ fontSize: "12px", color: "#8A93A3" }}
              >
                Al Olaya, Riyadh · 2.4 km away
              </Typography>
            </Stack>
          </Box>
          <Stack
            sx={{ alignItems: "center", backgroundColor: "#FFF7ED", borderRadius: "10px", padding: "6px 10px" }}
          >
            <Stack
              direction="row"
              spacing="2px"
              sx={{ alignItems: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 14, height: 14 }}
                  src="https://api.iconify.design/mdi/star.svg?color=%23F59E0B"
                />
              </Icon>
              <Typography
                sx={{ fontSize: "13px", fontWeight: 800, color: "#0B0F19" }}
              >
                4.8
              </Typography>
            </Stack>
            <Typography
              sx={{ fontSize: "10px", color: "#8A93A3" }}
            >
              210 reviews
            </Typography>
          </Stack>
        </Stack>
        <Stack
          direction="row"
          spacing="8px"
          sx={{ marginTop: "14px" }}
        >
          <Chip
            label="⚽ Football 5v5"
            sx={{ backgroundColor: "#0B0F19", color: "#FFFFFF", fontWeight: 700, fontSize: "11px", height: "28px" }}
          />
          <Chip
            label="Outdoor"
            sx={{ backgroundColor: "#F3F4F6", color: "#0B0F19", fontWeight: 600, fontSize: "11px", height: "28px" }}
          />
          <Chip
            label="Turf"
            sx={{ backgroundColor: "#F3F4F6", color: "#0B0F19", fontWeight: 600, fontSize: "11px", height: "28px" }}
          />
        </Stack>
        <Divider
          sx={{ margin: "16px 0" }}
        />
        <Typography
          sx={{ fontSize: "14px", fontWeight: 700, color: "#0B0F19", marginBottom: "10px" }}
        >
          Amenities
        </Typography>
        <Grid
          container={true}
          spacing={2}
        >
          <Grid
            item={true}
            xs={4}
          >
            <Stack
              sx={{ alignItems: "center" }}
              spacing="6px"
            >
              <Box
                sx={{ backgroundColor: "#FFFFFF", borderRadius: "12px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <Icon>
                  <img
                    style={{ width: 22, height: 22 }}
                    src="https://api.iconify.design/mdi/parking.svg?color=%23FF6A3D"
                  />
                </Icon>
              </Box>
              <Typography
                sx={{ fontSize: "10px", fontWeight: 600, color: "#0B0F19" }}
              >
                Parking
              </Typography>
            </Stack>
          </Grid>
          <Grid
            item={true}
            xs={4}
          >
            <Stack
              sx={{ alignItems: "center" }}
              spacing="6px"
            >
              <Box
                sx={{ backgroundColor: "#FFFFFF", borderRadius: "12px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <Icon>
                  <img
                    style={{ width: 22, height: 22 }}
                    src="https://api.iconify.design/mdi/shower.svg?color=%23FF6A3D"
                  />
                </Icon>
              </Box>
              <Typography
                sx={{ fontSize: "10px", fontWeight: 600, color: "#0B0F19" }}
              >
                Showers
              </Typography>
            </Stack>
          </Grid>
          <Grid
            item={true}
            xs={4}
          >
            <Stack
              sx={{ alignItems: "center" }}
              spacing="6px"
            >
              <Box
                sx={{ backgroundColor: "#FFFFFF", borderRadius: "12px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <Icon>
                  <img
                    style={{ width: 22, height: 22 }}
                    src="https://api.iconify.design/mdi/lightbulb-on-outline.svg?color=%23FF6A3D"
                  />
                </Icon>
              </Box>
              <Typography
                sx={{ fontSize: "10px", fontWeight: 600, color: "#0B0F19" }}
              >
                Floodlights
              </Typography>
            </Stack>
          </Grid>
        </Grid>
        <Divider
          sx={{ margin: "16px 0" }}
        />
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}
        >
          <Typography
            sx={{ fontSize: "14px", fontWeight: 700, color: "#0B0F19" }}
          >
            Available slots · Jul 23
          </Typography>
          <Stack
            direction="row"
            spacing="4px"
            sx={{ alignItems: "center" }}
          >
            <Icon>
              <img
                style={{ width: 14, height: 14 }}
                src="https://api.iconify.design/mdi/calendar-blank.svg?color=%23FF6A3D"
              />
            </Icon>
            <Typography
              sx={{ fontSize: "11px", fontWeight: 700, color: "#FF6A3D" }}
            >
              Change date
            </Typography>
          </Stack>
        </Stack>
        <Grid
          container={true}
          spacing={1.5}
        >
          <Grid
            item={true}
            xs={4}
          >
            <Box
              className="almus-slot"
              sx={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "8px 0", textAlign: "center", backgroundColor: "#FFFFFF" }}
            >
              <Typography
                sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
              >
                5:00 PM
              </Typography>
            </Box>
          </Grid>
          <Grid
            item={true}
            xs={4}
          >
            <Box
              className="almus-slot"
              sx={{ border: "2px solid #FF6A3D", borderRadius: "10px", padding: "8px 0", textAlign: "center", backgroundColor: "#FFF1EB" }}
            >
              <Typography
                sx={{ fontSize: "12px", fontWeight: 700, color: "#FF6A3D" }}
              >
                6:00 PM
              </Typography>
            </Box>
          </Grid>
          <Grid
            item={true}
            xs={4}
          >
            <Box
              sx={{ border: "1px solid #EEF0F3", borderRadius: "10px", padding: "8px 0", textAlign: "center", backgroundColor: "#F3F4F6" }}
            >
              <Typography
                sx={{ fontSize: "12px", fontWeight: 600, color: "#C2C7D0" }}
              >
                7:00 PM
              </Typography>
            </Box>
          </Grid>
          <Grid
            item={true}
            xs={4}
          >
            <Box
              className="almus-slot"
              sx={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "8px 0", textAlign: "center", backgroundColor: "#FFFFFF" }}
            >
              <Typography
                sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
              >
                8:00 PM
              </Typography>
            </Box>
          </Grid>
          <Grid
            item={true}
            xs={4}
          >
            <Box
              className="almus-slot"
              sx={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "8px 0", textAlign: "center", backgroundColor: "#FFFFFF" }}
            >
              <Typography
                sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
              >
                9:00 PM
              </Typography>
            </Box>
          </Grid>
          <Grid
            item={true}
            xs={4}
          >
            <Box
              sx={{ border: "1px solid #EEF0F3", borderRadius: "10px", padding: "8px 0", textAlign: "center", backgroundColor: "#F3F4F6" }}
            >
              <Typography
                sx={{ fontSize: "12px", fontWeight: 600, color: "#C2C7D0" }}
              >
                10:00 PM
              </Typography>
            </Box>
          </Grid>
        </Grid>
        <Box
          sx={{ marginTop: "18px", backgroundColor: "#FFFFFF", borderRadius: "14px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <Avatar
            sx={{ width: 40, height: 40, backgroundColor: "#0B0F19", fontSize: "14px", fontWeight: 700 }}
          >
            AN
          </Avatar>
          <Box
            sx={{ flex: 1 }}
          >
            <Typography
              sx={{ fontSize: "13px", fontWeight: 700, color: "#0B0F19" }}
            >
              Al Nakheel Arena
            </Typography>
            <Typography
              sx={{ fontSize: "11px", color: "#8A93A3" }}
            >
              Usually replies within 10 min
            </Typography>
          </Box>
          <IconButton
            sx={{ backgroundColor: "#F3F4F6", width: "38px", height: "38px" }}
          >
            <Icon>
              <img
                style={{ width: 18, height: 18 }}
                src="https://api.iconify.design/mdi/message-text-outline.svg?color=%23FF6A3D"
              />
            </Icon>
          </IconButton>
        </Box>
      </Box>
      <Box
        sx={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFF", borderTop: "1px solid #EEF0F3", padding: "14px 20px 24px 20px" }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}
        >
          <Box>
            <Typography
              sx={{ fontSize: "11px", color: "#8A93A3" }}
            >
              1 hour · 6:00 PM
            </Typography>
            <Typography
              sx={{ fontSize: "18px", fontWeight: 800, color: "#0B0F19" }}
            >
              SAR 120
            </Typography>
          </Box>
          <Button
            variant="contained"
            sx={{ backgroundColor: "#FF6A3D", textTransform: "none", fontWeight: 700, borderRadius: "12px", padding: "10px 28px", fontSize: "14px", boxShadow: "none" }}
          >
            Book Now
          </Button>
        </Stack>
      </Box>
    </Box>
  </Box>
  <Box
    sx={{ width: "380px", height: "812px", backgroundColor: "#0B0F19", borderRadius: "40px", padding: "10px", boxShadow: "0 20px 50px rgba(0,0,0,0.35)", flexShrink: 0 }}
  >
    <Box
      sx={{ width: "100%", height: "100%", backgroundColor: "rgba(11,15,25,0.5)", borderRadius: "32px", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <Box
        sx={{ padding: "4px 20px 8px 20px", display: "flex", justifyContent: "space-between", position: "absolute", top: 0, left: 0, right: 0 }}
      >
        <Typography
          sx={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF", paddingTop: "12px" }}
        >
          9:41
        </Typography>
      </Box>
      <Box
        sx={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: "28px", borderTopRightRadius: "28px", padding: "10px 22px 26px 22px", maxHeight: "82%", overflowY: "auto" }}
      >
        <Box
          sx={{ width: "40px", height: "4px", backgroundColor: "#E5E7EB", borderRadius: "2px", margin: "0 auto 16px auto" }}
        />
        <Typography
          sx={{ fontSize: "17px", fontWeight: 800, color: "#0B0F19", marginBottom: "4px" }}
        >
          Confirm your booking
        </Typography>
        <Typography
          sx={{ fontSize: "12px", color: "#8A93A3", marginBottom: "16px" }}
        >
          Review details before you pay
        </Typography>
        <Box
          sx={{ backgroundColor: "#F7F8FA", borderRadius: "14px", padding: "14px", marginBottom: "16px" }}
        >
          <Stack
            direction="row"
            spacing="12px"
            sx={{ alignItems: "center", marginBottom: "10px" }}
          >
            <Box
              sx={{ width: "52px", height: "52px", borderRadius: "10px", overflow: "hidden" }}
            >
              <Image
                src="https://uc.uxpin.com/ai-chat/d279ab32ec221f17/images/1784822486100-c1366b0d61322210.png"
                fit="cover"
                width="52px"
                height="52px"
              />
            </Box>
            <Box>
              <Typography
                sx={{ fontSize: "13px", fontWeight: 700, color: "#0B0F19" }}
              >
                Al Nakheel Futsal Arena
              </Typography>
              <Typography
                sx={{ fontSize: "11px", color: "#8A93A3" }}
              >
                Football · 5v5 court
              </Typography>
            </Box>
          </Stack>
          <Divider
            sx={{ margin: "10px 0" }}
          />
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", marginBottom: "6px" }}
          >
            <Typography
              sx={{ fontSize: "12px", color: "#8A93A3" }}
            >
              Date
            </Typography>
            <Typography
              sx={{ fontSize: "12px", fontWeight: 700, color: "#0B0F19" }}
            >
              Wed, Jul 23 2026
            </Typography>
          </Stack>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", marginBottom: "6px" }}
          >
            <Typography
              sx={{ fontSize: "12px", color: "#8A93A3" }}
            >
              Time
            </Typography>
            <Typography
              sx={{ fontSize: "12px", fontWeight: 700, color: "#0B0F19" }}
            >
              6:00 PM – 7:00 PM
            </Typography>
          </Stack>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between" }}
          >
            <Typography
              sx={{ fontSize: "12px", color: "#8A93A3" }}
            >
              Players
            </Typography>
            <Typography
              sx={{ fontSize: "12px", fontWeight: 700, color: "#0B0F19" }}
            >
              10 max
            </Typography>
          </Stack>
        </Box>
        <Typography
          sx={{ fontSize: "13px", fontWeight: 700, color: "#0B0F19", marginBottom: "10px" }}
        >
          Payment method
        </Typography>
        <Stack
          spacing="10px"
          sx={{ marginBottom: "16px" }}
        >
          <Box
            sx={{ border: "2px solid #FF6A3D", backgroundColor: "#FFF1EB", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <Stack
              direction="row"
              spacing="10px"
              sx={{ alignItems: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 20, height: 20 }}
                  src="https://api.iconify.design/mdi/credit-card-outline.svg?color=%23FF6A3D"
                />
              </Icon>
              <Typography
                sx={{ fontSize: "13px", fontWeight: 700, color: "#0B0F19" }}
              >
                Visa •••• 4821
              </Typography>
            </Stack>
            <Icon>
              <img
                style={{ width: 18, height: 18 }}
                src="https://api.iconify.design/mdi/check-circle.svg?color=%23FF6A3D"
              />
            </Icon>
          </Box>
          <Box
            sx={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <Stack
              direction="row"
              spacing="10px"
              sx={{ alignItems: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 22, height: 20 }}
                  src="https://api.iconify.design/simple-icons/applepay.svg?color=%230B0F19"
                />
              </Icon>
              <Typography
                sx={{ fontSize: "13px", fontWeight: 600, color: "#0B0F19" }}
              >
                Apple Pay
              </Typography>
            </Stack>
          </Box>
          <Box
            sx={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <Stack
              direction="row"
              spacing="10px"
              sx={{ alignItems: "center" }}
            >
              <Icon>
                <img
                  style={{ width: 20, height: 20 }}
                  src="https://api.iconify.design/mdi/wallet-outline.svg?color=%230B0F19"
                />
              </Icon>
              <Typography
                sx={{ fontSize: "13px", fontWeight: 600, color: "#0B0F19" }}
              >
                Pay at venue
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", marginBottom: "4px" }}
        >
          <Typography
            sx={{ fontSize: "12px", color: "#8A93A3" }}
          >
            Court fee
          </Typography>
          <Typography
            sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
          >
            SAR 120
          </Typography>
        </Stack>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", marginBottom: "10px" }}
        >
          <Typography
            sx={{ fontSize: "12px", color: "#8A93A3" }}
          >
            Service fee
          </Typography>
          <Typography
            sx={{ fontSize: "12px", fontWeight: 600, color: "#0B0F19" }}
          >
            SAR 8
          </Typography>
        </Stack>
        <Divider
          sx={{ marginBottom: "10px" }}
        />
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", marginBottom: "18px" }}
        >
          <Typography
            sx={{ fontSize: "14px", fontWeight: 800, color: "#0B0F19" }}
          >
            Total
          </Typography>
          <Typography
            sx={{ fontSize: "16px", fontWeight: 800, color: "#FF6A3D" }}
          >
            SAR 128
          </Typography>
        </Stack>
        <Button
          variant="contained"
          fullWidth={true}
          sx={{ backgroundColor: "#FF6A3D", textTransform: "none", fontWeight: 700, borderRadius: "12px", padding: "13px 0", fontSize: "15px", boxShadow: "none" }}
        >
          Confirm & Pay SAR 128
        </Button>
      </Box>
    </Box>
  </Box>
</Box>);
}