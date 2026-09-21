<#
.SYNOPSIS
  Aviso visual de desligamento às 19:00 com contagem regressiva de 5 minutos.
#>

param(
    [int]$TimeoutSeconds = 300, # 5 minutos (300 segundos)
    [string]$Action = "sleep"   # "sleep" (suspensão para acordar às 07h) ou "shutdown"
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

# 1. Encerra o bot primeiro
$projDir = Split-Path -Parent $PSScriptRoot
$stopScript = Join-Path $projDir "src\stop.js"
if (Test-Path $stopScript) {
    try {
        & node $stopScript | Out-Null
    } catch {}
}

# 2. Interface Gráfica WPF
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Aviso de Desligamento - WhatsApp Guincho Bot"
        Height="360" Width="520"
        WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize"
        Topmost="True"
        Background="#0f172a">
    <Window.Resources>
        <Style TargetType="Button">
            <Setter Property="FontFamily" Value="Segoe UI"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="FontSize" Value="14"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Padding" Value="14,10"/>
        </Style>
    </Window.Resources>

    <Grid Margin="24">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- Header -->
        <StackPanel Grid.Row="0" Orientation="Horizontal" Margin="0,0,0,16">
            <TextBlock Text="⏰" FontSize="32" VerticalAlignment="Center" Margin="0,0,12,0"/>
            <StackPanel VerticalAlignment="Center">
                <TextBlock Text="Expediente Encerrado (19:00)" FontSize="18" FontWeight="Bold" Foreground="#f8fafc"/>
                <TextBlock Text="O WhatsApp Guincho Bot foi pausado com segurança." FontSize="12" Foreground="#94a3b8"/>
            </StackPanel>
        </StackPanel>

        <!-- Countdown Card -->
        <Border Grid.Row="1" Background="#1e293b" CornerRadius="10" Padding="18" Margin="0,0,0,16" BorderBrush="#334155" BorderThickness="1">
            <StackPanel HorizontalAlignment="Center">
                <TextBlock Text="O computador será desligado automaticamente em:" FontSize="13" Foreground="#cbd5e1" HorizontalAlignment="Center" Margin="0,0,0,6"/>
                <TextBlock x:Name="TxtCountdown" Text="05:00" FontSize="42" FontWeight="Bold" Foreground="#38bdf8" HorizontalAlignment="Center"/>
                <TextBlock Text="Nenhuma ação necessária caso já tenha saído." FontSize="11" Foreground="#64748b" HorizontalAlignment="Center" Margin="0,4,0,0"/>
            </StackPanel>
        </Border>

        <!-- Instructions -->
        <TextBlock Grid.Row="2" Text="Deseja continuar utilizando o computador para horas extras ou uso pessoal?" 
                   FontSize="12" Foreground="#94a3b8" TextWrapping="Wrap" HorizontalAlignment="Center" Margin="0,0,0,16"/>

        <!-- Action Buttons -->
        <Grid Grid.Row="3">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="12"/>
                <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>

            <Button x:Name="BtnCancel" Grid.Column="0" Content="❌ Cancelar Desligamento (Manter Ligado)" 
                    Background="#3b82f6" Foreground="White" BorderThickness="0"/>

            <Button x:Name="BtnShutdownNow" Grid.Column="2" Content="⏻ Desligar Agora" 
                    Background="#334155" Foreground="#f1f5f9" BorderThickness="0"/>
        </Grid>
    </Grid>
</Window>
"@

$reader = (New-Object System.Xml.XmlNodeReader $xaml)
$window = [System.Windows.Markup.XamlReader]::Load($reader)

$txtCountdown = $window.FindName("TxtCountdown")
$btnCancel = $window.FindName("BtnCancel")
$btnShutdownNow = $window.FindName("BtnShutdownNow")

$remainingSeconds = $TimeoutSeconds
$cancelled = $false

# Timer do Countdown
$dispatcherTimer = New-Object System.Windows.Threading.DispatcherTimer
$dispatcherTimer.Interval = [TimeSpan]::FromSeconds(1)

$dispatcherTimer.Add_Tick({
    $script:remainingSeconds--

    if ($script:remainingSeconds -le 0) {
        $dispatcherTimer.Stop()
        $window.Close()
    } else {
        $minutes = [Math]::Floor($script:remainingSeconds / 60)
        $seconds = $script:remainingSeconds % 60
        $txtCountdown.Text = ("{0:D2}:{1:D2}" -f $minutes, $seconds)

        if ($script:remainingSeconds -le 60) {
            $txtCountdown.Foreground = [System.Windows.Media.Brushes]::IndianRed
        }
    }
})

$btnCancel.Add_Click({
    $script:cancelled = $true
    $dispatcherTimer.Stop()
    $window.Close()
})

$btnShutdownNow.Add_Click({
    $script:remainingSeconds = 0
    $dispatcherTimer.Stop()
    $window.Close()
})

$window.Add_Closing({
    $dispatcherTimer.Stop()
})

$dispatcherTimer.Start()
$window.ShowDialog() | Out-Null

# 3. Execução Final
if ($cancelled) {
    Write-Host "[OK] Desligamento cancelado pelo operador. O computador continuará ligado!"
    exit 0
}

Write-Host "[INFO] Tempo de espera de 5 minutos esgotado. Iniciando desligamento/suspensao..."

if ($Action -eq "shutdown") {
    # Desligamento Completo
    & shutdown.exe /s /f /t 5 /c "Desligamento automatico programado das 19:00"
} else {
    # Suspensão (Sleep S3/S4) que permite ao Agendador acordar o PC às 07:00 com WakeToRun
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)
}

