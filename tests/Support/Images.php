<?php

namespace Tests\Support;

/** Builds real PNG bytes without the GD extension (it is not installed in the app image). */
final class Images
{
    public static function png(int $width, int $height): string
    {
        $chunk = fn (string $type, string $data): string => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
        $row = "\x00".str_repeat("\x80", $width); // filter byte + grey pixels

        return "\x89PNG\r\n\x1a\n"
            .$chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 0, 0, 0, 0))
            .$chunk('IDAT', gzcompress(str_repeat($row, $height)))
            .$chunk('IEND', '');
    }
}
