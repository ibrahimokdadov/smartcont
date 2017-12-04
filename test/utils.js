export const generateAddresses = (count) => {
  let res = [];
  for (let i = 0; i < count; i++) {
    let address = '0x';
    for (let j = 0; j < 40; j++) {
      address = address + Math.floor(Math.random()*10).toString();
    }
    res.push(address);
  }
  return res;
}