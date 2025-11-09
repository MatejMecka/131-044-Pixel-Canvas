#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, vec, Env, String, Vec, Address, token};

#[contract]
pub struct Contract;

const CANVAS_WIDTH: u32 = 362;
const CANVAS_HEIGHT: u32 = 362;

// Store each BYTE separately as u32 (Soroban doesn't support u8 in storage)
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    PixelByte(u32), // Store each byte of canvas separately (0 to 65521)
    PaintedPixels,
    Admin,
    UserPixelCount(Address), // Track pixel count per user
    LeaderboardAddresses, // Vector of addresses for leaderboard
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PixelInfo {
    pub x: u32,
    pub y: u32,
    pub colour: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub address: Address,
    pub pixel_count: u32,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    OverflowValue = 2,
    LowBalance = 3,
    InvalidColor = 4,
    EntryExists = 5,
    InvalidPixelCount = 6,
    TooManyPixels = 7,
    NotInitialized = 8,
    AlreadyInitialized = 10,
}

const MAX_PIXELS_PER_TX: u32 = 100;

#[contractimpl]
impl Contract {
    fn get_admin(env: &Env) -> Result<Address, Error> {
        env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)
    }

    // Ultra-lightweight initialization
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        
        env.storage().persistent().set(&DataKey::Admin, &admin);
        
        // Initialize empty painted pixels list
        let empty_pixels: Vec<PixelInfo> = vec![&env];
        env.storage().persistent().set(&DataKey::PaintedPixels, &empty_pixels);
        
        // Initialize empty leaderboard
        let empty_addresses: Vec<Address> = vec![&env];
        env.storage().persistent().set(&DataKey::LeaderboardAddresses, &empty_addresses);
        
        Ok(())
    }

    pub fn is_initialized(env: Env) -> bool {
        env.storage().persistent().has(&DataKey::Admin)
    }

    // Helper: Calculate byte index and nibble position
    fn get_pixel_location(x: u32, y: u32) -> (u32, bool) {
        let pixel_index = y * CANVAS_WIDTH + x;
        let byte_index = pixel_index / 2;
        let is_high_nibble = pixel_index % 2 == 0;
        (byte_index, is_high_nibble)
    }

    // Get pixel color (each byte stored as u32)
    fn get_pixel_internal(env: &Env, x: u32, y: u32) -> u32 {
        let (byte_index, is_high_nibble) = Self::get_pixel_location(x, y);
        
        // Get byte as u32 (defaults to 0 if not set)
        let byte: u32 = env.storage().persistent()
            .get(&DataKey::PixelByte(byte_index))
            .unwrap_or(0);
        
        if is_high_nibble {
            (byte >> 4) & 0x0F
        } else {
            byte & 0x0F
        }
    }

    // Set pixel color (each byte stored as u32)
    fn set_pixel_internal(env: &Env, x: u32, y: u32, colour: u32) {
        let (byte_index, is_high_nibble) = Self::get_pixel_location(x, y);
        
        // Get existing byte as u32 (or 0 if new)
        let current_byte: u32 = env.storage().persistent()
            .get(&DataKey::PixelByte(byte_index))
            .unwrap_or(0);
        
        let new_byte = if is_high_nibble {
            (current_byte & 0x0F) | (colour << 4)
        } else {
            (current_byte & 0xF0) | colour
        };
        
        env.storage().persistent().set(&DataKey::PixelByte(byte_index), &new_byte);
    }

    // Update user's pixel count and leaderboard
    fn update_user_pixel_count(env: &Env, user: &Address, pixels_added: u32) {
        // Get current count
        let current_count: u32 = env.storage().persistent()
            .get(&DataKey::UserPixelCount(user.clone()))
            .unwrap_or(0);
        
        let new_count = current_count + pixels_added;
        
        // Update count
        env.storage().persistent().set(&DataKey::UserPixelCount(user.clone()), &new_count);
        
        // Update leaderboard addresses list if new user
        if current_count == 0 {
            let mut addresses: Vec<Address> = env.storage().persistent()
                .get(&DataKey::LeaderboardAddresses)
                .unwrap_or(vec![env]);
            addresses.push_back(user.clone());
            env.storage().persistent().set(&DataKey::LeaderboardAddresses, &addresses);
        }
    }

    pub fn place(env: Env, user: Address, x: u32, y: u32, colour: u32) -> Result<bool, Error> {
        user.require_auth();

        if !Self::is_initialized(env.clone()) {
            return Err(Error::NotInitialized);
        }

        if x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT {
            return Err(Error::OverflowValue);
        }

        if colour > 15 || colour == 0 {
            return Err(Error::InvalidColor);
        }

        // Check if pixel already painted
        if Self::get_pixel_internal(&env, x, y) != 0 {
            return Err(Error::EntryExists);
        }

        // Payment logic
        let native_asset_address = Address::from_str(&env, "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4");
        let native_client = token::Client::new(&env, &native_asset_address);
        let cost = 10000000_i128;

        if cost > native_client.balance(&user) {
            return Err(Error::LowBalance);
        }

        // Set pixel
        Self::set_pixel_internal(&env, x, y, colour);

        // Add to painted pixels list
        let mut painted: Vec<PixelInfo> = env.storage().persistent()
            .get(&DataKey::PaintedPixels)
            .unwrap_or(vec![&env]);
        painted.push_back(PixelInfo { x, y, colour });
        env.storage().persistent().set(&DataKey::PaintedPixels, &painted);

        // Update leaderboard
        Self::update_user_pixel_count(&env, &user, 1);

        Ok(true)
    }

    pub fn place_multiple(
        env: Env, 
        user: Address, 
        pixels: Vec<PixelInfo>
    ) -> Result<bool, Error> {
        user.require_auth();

        if !Self::is_initialized(env.clone()) {
            return Err(Error::NotInitialized);
        }

        let pixel_count = pixels.len();
        
        if pixel_count == 0 {
            return Err(Error::InvalidPixelCount);
        }
        
        if pixel_count > MAX_PIXELS_PER_TX {
            return Err(Error::TooManyPixels);
        }

        // Validate all pixels
        for pixel in pixels.iter() {
            if pixel.x >= CANVAS_WIDTH || pixel.y >= CANVAS_HEIGHT {
                return Err(Error::OverflowValue);
            }

            if pixel.colour > 15 || pixel.colour == 0 {
                return Err(Error::InvalidColor);
            }

            // Check if already painted
            if Self::get_pixel_internal(&env, pixel.x, pixel.y) != 0 {
                return Err(Error::EntryExists);
            }
        }

        // Payment logic
        let cost_per_pixel = 10000000_i128;
        let total_cost = cost_per_pixel.checked_mul(pixel_count as i128)
            .ok_or(Error::OverflowValue)?;
        
        let native_asset_address = Address::from_str(&env, "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4");
        let native_client = token::Client::new(&env, &native_asset_address);

        if total_cost > native_client.balance(&user) {
            return Err(Error::LowBalance);
        }

        // Get painted pixels list
        let mut painted: Vec<PixelInfo> = env.storage().persistent()
            .get(&DataKey::PaintedPixels)
            .unwrap_or(vec![&env]);

        // Place all pixels
        for pixel in pixels.iter() {
            Self::set_pixel_internal(&env, pixel.x, pixel.y, pixel.colour);
            painted.push_back(pixel);
        }

        // Save painted list
        env.storage().persistent().set(&DataKey::PaintedPixels, &painted);

        // Update leaderboard
        Self::update_user_pixel_count(&env, &user, pixel_count);

        Ok(true)
    }

    pub fn get_pixel(env: Env, x: u32, y: u32) -> u32 {
        if x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT {
            return 0;
        }
        Self::get_pixel_internal(&env, x, y)
    }

    // Get multiple pixels efficiently
    pub fn get_pixels(env: Env, coords: Vec<(u32, u32)>) -> Vec<u32> {
        let mut result = vec![&env];
        for coord in coords.iter() {
            if coord.0 < CANVAS_WIDTH && coord.1 < CANVAS_HEIGHT {
                result.push_back(Self::get_pixel_internal(&env, coord.0, coord.1));
            } else {
                result.push_back(0);
            }
        }
        result
    }

    pub fn list_painted_pixels(env: Env) -> Vec<PixelInfo> {
        env.storage().persistent()
            .get(&DataKey::PaintedPixels)
            .unwrap_or(vec![&env])
    }

    pub fn get_pixel_count(env: Env) -> u32 {
        let painted: Vec<PixelInfo> = env.storage().persistent()
            .get(&DataKey::PaintedPixels)
            .unwrap_or(vec![&env]);
        painted.len()
    }

    // Get pixel count for a specific user
    pub fn get_user_pixel_count(env: Env, user: Address) -> u32 {
        env.storage().persistent()
            .get(&DataKey::UserPixelCount(user))
            .unwrap_or(0)
    }

    // Get leaderboard (unsorted - sort on client side)
    pub fn get_leaderboard(env: Env) -> Vec<LeaderboardEntry> {
        let addresses: Vec<Address> = env.storage().persistent()
            .get(&DataKey::LeaderboardAddresses)
            .unwrap_or(vec![&env]);
        
        // Build leaderboard entries
        let mut entries = vec![&env];
        for address in addresses.iter() {
            let count: u32 = env.storage().persistent()
                .get(&DataKey::UserPixelCount(address.clone()))
                .unwrap_or(0);
            
            entries.push_back(LeaderboardEntry {
                address: address.clone(),
                pixel_count: count,
            });
        }
        
        entries
    }

    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello!"), to]
    }
}

mod test;