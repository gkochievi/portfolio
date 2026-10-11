/**
 * Owner: data agent. Ritmuli Events staff and the visitors who registered at
 * the stand. All people, companies and contact details are fictional: emails
 * use `.example` domains and every phone is a `+995 555 00 .. ..` dummy.
 *
 * Players get their `createdAt` in `generate.ts` (each signed up shortly
 * before their first round), so this file only holds profiles.
 */
import type { User } from '@/types'
import { onDay } from './time'

/** Obviously fake Georgian mobile numbers, unique per seat. */
export function fakePhone(seat: number): string {
  const n = (1203 + seat * 317) % 10_000
  const pair = (value: number) => String(value).padStart(2, '0')
  return `+995 555 00 ${pair(Math.floor(n / 100))} ${pair(n % 100)}`
}

const ORGANISER = 'Ritmuli Events'

function staff(
  seat: number,
  id: string,
  firstName: string,
  lastName: string,
  handle: string,
  role: User['role'],
  position: string,
  createdAt: string,
): User {
  return {
    id,
    email: `${handle}@tova.example`,
    username: `${handle}.${lastName.charAt(0).toLowerCase()}`,
    firstName,
    lastName,
    phone: fakePhone(seat),
    company: ORGANISER,
    position,
    role,
    isAdmin: role === 'SUPERADMIN' || role === 'ADMIN',
    disabled: false,
    guest: false,
    createdAt,
  }
}

/** The organiser's console accounts (3 demo accounts plus a second admin). */
export const STAFF: User[] = [
  staff(1, 'usr_tamar', 'Tamar', 'Beridze', 'tamar', 'SUPERADMIN', 'Managing director', onDay(-96, 8, 12)),
  staff(2, 'usr_davit', 'Davit', 'Lomidze', 'davit', 'ADMIN', 'Stand manager', onDay(-81, 9, 40)),
  staff(3, 'usr_nodar', 'Nodar', 'Esebua', 'nodar', 'ADMIN', 'Producer', onDay(-64, 11, 5)),
  staff(4, 'usr_mariam', 'Mariam', 'Abashidze', 'mariam', 'SUPERVISOR', 'Floor supervisor', onDay(-47, 7, 30)),
]

export type PlayerProfile = Omit<User, 'role' | 'isAdmin' | 'guest' | 'createdAt' | 'username' | 'phone'>

/** The demo player first, then the 24 visitors. Ghosts `usr_g1..3` play live rounds in the simulator. */
export const PLAYER_PROFILES: PlayerProfile[] = [
  { id: 'usr_saba', firstName: 'Saba', lastName: 'Metreveli', email: 'saba@tova.example', company: 'Sololaki Studio', position: 'Product designer', disabled: false },
  { id: 'usr_p01', firstName: 'Gvantsa', lastName: 'Mchedlishvili', email: 'gvantsa@kvamli-coffee.example', company: 'Kvamli Coffee', position: 'Barista trainer', disabled: false },
  { id: 'usr_g1', firstName: 'Tornike', lastName: 'Beradze', email: 'tornike@lurji-velo.example', company: 'Lurji Velo', position: 'Sales lead', disabled: false },
  { id: 'usr_g2', firstName: 'Natia', lastName: 'Kipiani', email: 'natia.k@mail.example', company: 'Tbilisi Print House', position: 'Designer', disabled: false },
  { id: 'usr_g3', firstName: 'Shota', lastName: 'Lortkipanidze', email: 'shota@mtatsminda-logistics.example', company: 'Mtatsminda Logistics', position: 'Operations manager', disabled: false },
  { id: 'usr_p05', firstName: 'Khatia', lastName: 'Asatiani', email: 'khatia@arsiani-bakery.example', company: 'Arsiani Bakery', position: 'Head baker', disabled: false },
  { id: 'usr_p06', firstName: 'Archil', lastName: 'Javakhishvili', email: 'archil.photo@mail.example', company: 'Freelance', position: 'Photographer', disabled: false },
  { id: 'usr_p07', firstName: 'ნანა', lastName: 'კობიაშვილი', email: 'nana@mzevali-tea.example', company: 'მზევალი ჩაი', position: 'ბრენდ-მენეჯერი', disabled: false },
  { id: 'usr_p08', firstName: 'Giga', lastName: 'Tsereteli', email: 'giga.ts@mail.example', company: 'Saguramo Farms', position: 'Agronomist', disabled: false },
  { id: 'usr_p09', firstName: 'Tinatin', lastName: 'Gabunia', email: 'tinatin@tetri-kalami.example', company: 'Tetri Kalami', position: 'Marketing coordinator', disabled: false },
  { id: 'usr_p10', firstName: 'Otar', lastName: 'Kvirikashvili', email: 'otar@didube-hardware.example', company: 'Didube Hardware', position: 'Store manager', disabled: false },
  { id: 'usr_p11', firstName: 'Ia', lastName: 'Sulaberidze', email: 'iasulab@mail.example', company: '', position: 'Student', disabled: false },
  { id: 'usr_p12', firstName: 'Merab', lastName: 'Abuladze', email: 'merab@vake-dental.example', company: 'Vake Dental Studio', position: 'Dentist', disabled: false },
  { id: 'usr_p13', firstName: 'ეკა', lastName: 'პატარაია', email: 'eka@narikala-travel.example', company: 'ნარიყალა ტრაველი', position: 'ტურისტული აგენტი', disabled: false },
  { id: 'usr_p14', firstName: 'Dachi', lastName: 'Kharabadze', email: 'dachi@kodala-games.example', company: 'Kodala Games', position: 'Developer', disabled: true },
  { id: 'usr_p15', firstName: 'Lela', lastName: 'Turmanidze', email: 'lela.t@mail.example', company: 'Batumi Language Centre', position: 'Teacher', disabled: false },
  { id: 'usr_p16', firstName: 'Zviad', lastName: 'Meskhi', email: 'zviad@aragvi-outdoor.example', company: 'Aragvi Outdoor', position: 'Mountain guide', disabled: false },
  { id: 'usr_p17', firstName: 'Manana', lastName: 'Dvali', email: 'manana@pilpili-kitchen.example', company: 'Pilpili Kitchen', position: 'Chef', disabled: false },
  { id: 'usr_p18', firstName: 'თემურ', lastName: 'ჯღერენაია', email: 'temur.jg@mail.example', company: 'ქუთაისის ავტონაწილები', position: 'მფლობელი', disabled: false },
  { id: 'usr_p19', firstName: 'Nestan', lastName: 'Gvazava', email: 'nestan@mziuri-studio.example', company: 'Mziuri Studio', position: 'Animator', disabled: false },
  { id: 'usr_p20', firstName: 'Bachana', lastName: 'Tsintsadze', email: 'bachana@gori-fruit.example', company: 'Gori Fruit Co.', position: 'Buyer', disabled: false },
  { id: 'usr_p21', firstName: 'მზია', lastName: 'გელოვანი', email: 'mzia.g@mail.example', company: '', position: 'სტუმარი', disabled: false },
  { id: 'usr_p22', firstName: 'Rusudan', lastName: 'Lomtadze', email: 'rusudan@tbilisi-print.example', company: 'Tbilisi Print House', position: 'Account manager', disabled: false },
  { id: 'usr_p23', firstName: 'Vakho', lastName: 'Chitaia', email: 'vakho@rioni-watersports.example', company: 'Rioni Water Sports', position: 'Instructor', disabled: false },
  {
    id: 'usr_p24',
    firstName: 'Tekle-Nestan',
    lastName: 'Andronikashvili-Tsulukidze',
    email: 'tekle-nestan.andronikashvili-tsulukidze@caucasus-hospitality-network.example',
    company: 'Caucasus Mountain Hospitality, Wine Tourism and Regional Partner Network Association',
    position: 'Senior partnerships and community development coordinator',
    disabled: false,
  },
]

/** Registered but never played (the "no rounds yet" rows). */
export const NEVER_PLAYED: ReadonlySet<string> = new Set(['usr_p11', 'usr_p21'])

/** Fixed signup times for the players who have no rounds, and the demo player. */
export const FIXED_SIGNUPS: Readonly<Record<string, string>> = {
  usr_saba: onDay(0, 8, 0), // two hours before the anchor
  usr_p11: onDay(0, 7, 2),
  usr_p21: onDay(0, 9, 18),
}

export const playerPhone = (index: number): string => fakePhone(10 + index)
