/** The eight one-click demo personas (brand brief) and the tenant. Architect-owned. */
import type { Persona, Tenant } from '@/types'

export const TENANT: Tenant = {
  name: 'Saguramo Mutual',
  nameKa: 'საგურამო მუტუალი',
  timeZone: 'Asia/Tbilisi',
  domain: 'bani.example',
}

export const DEMO_PASSWORD = 'bani-demo'

const persona = (
  username: string,
  name: string,
  nameKa: string,
  role: Persona['role'],
  roleLabel: string,
  description: string,
  avatarColor: string,
): Persona => ({
  id: username,
  username,
  name,
  nameKa,
  email: `${username}@bani.example`,
  password: DEMO_PASSWORD,
  role,
  roleLabel,
  description,
  avatarColor,
})

export const personas: Persona[] = [
  persona('ana.lomidze', 'Ana Lomidze', 'ანა ლომიძე', 'superadmin', 'Superadmin', 'Everything, including People and no campaign port cap.', '#A3441A'),
  persona('giorgi.beridze', 'Giorgi Beridze', 'გიორგი ბერიძე', 'admin', 'Administrator', 'Runs the whole estate except console accounts.', '#2F5D4E'),
  persona('nino.chikovani', 'Nino Chikovani', 'ნინო ჩიქოვანი', 'cc-admin', 'Contact-centre admin', 'Core Cluster calls, agents, campaigns (port cap 10), nodes.', '#3F6178'),
  persona('levan.gelashvili', 'Levan Gelashvili', 'ლევან გელაშვილი', 'tel-admin', 'Telephony admin', 'Edge PBX call records only.', '#8AA394'),
  persona('mariam.kapanadze', 'Mariam Kapanadze', 'მარიამ კაპანაძე', 'cc-operator', 'Contact-centre operator', 'Core Cluster call records only.', '#7A5A2E'),
  persona('davit.kiknadze', 'Davit Kiknadze', 'დავით კიკნაძე', 'tel-operator', 'Telephony operator', 'Edge PBX call records only.', '#56625A'),
  persona('salome.shengelia', 'Salome Shengelia', 'სალომე შენგელია', 'it-support', 'IT support', 'Reserves and creates extensions.', '#B8732C'),
  persona('luka.japaridze', 'Luka Japaridze', 'ლუკა ჯაფარიძე', 'user', 'Read-only', 'Searches call records on both platforms.', '#16211B'),
]
